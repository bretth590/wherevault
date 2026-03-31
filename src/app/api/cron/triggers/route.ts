import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDeadManSwitchWarning } from "@/lib/email";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results = { dms: 0, inactivity: 0, promoted: 0 };

  try {
    // 1. Check Dead Man Switches
    const overdueUsers = await prisma.user.findMany({
      where: {
        checkInIntervalDays: { not: null },
        lastCheckIn: { not: null },
      },
      select: {
        id: true,
        email: true,
        name: true,
        lastCheckIn: true,
        checkInIntervalDays: true,
      },
    });

    for (const user of overdueUsers) {
      const dueDate = new Date(
        user.lastCheckIn!.getTime() + user.checkInIntervalDays! * 24 * 60 * 60 * 1000,
      );
      if (now <= dueDate) continue;

      const daysOverdue = Math.floor(
        (now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000),
      );

      const armedTriggers = await prisma.accessTrigger.findMany({
        where: { userId: user.id, type: "DEAD_MAN_SWITCH", status: "ARMED" },
      });

      for (const trigger of armedTriggers) {
        try {
          await sendDeadManSwitchWarning(user.email, user.name ?? "WhereVault User", daysOverdue);
          await prisma.auditLog.create({
            data: {
              ownerId: user.id,
              actorId: user.id,
              action: "DEAD_MAN_SWITCH_WARNING",
              details: { triggerId: trigger.id, daysOverdue },
            },
          });
        } catch (err) {
          console.error(`[Cron] Failed to send DMS warning to ${user.email}:`, err);
        }

        const executesAt = new Date(now.getTime() + trigger.delayDays * 24 * 60 * 60 * 1000);

        if (trigger.delayDays === 0) {
          await prisma.$transaction(async (tx) => {
            await tx.accessTrigger.update({
              where: { id: trigger.id },
              data: { status: "EXECUTED", triggeredAt: now, executesAt: now, executedAt: now },
            });
            await tx.trustee.updateMany({
              where: { grantorId: user.id, status: "ACCEPTED", activatedAt: null },
              data: { activatedAt: now, activatedBy: trigger.id },
            });
            await tx.auditLog.create({
              data: {
                ownerId: user.id,
                actorId: user.id,
                action: "TRIGGER_EXECUTED",
                details: { triggerId: trigger.id, type: "DEAD_MAN_SWITCH", daysOverdue, automatic: true },
              },
            });
          });
        } else {
          await prisma.$transaction(async (tx) => {
            await tx.accessTrigger.update({
              where: { id: trigger.id },
              data: { status: "TRIGGERED", triggeredAt: now, executesAt },
            });
            await tx.auditLog.create({
              data: {
                ownerId: user.id,
                actorId: user.id,
                action: "TRIGGER_FIRED",
                details: { triggerId: trigger.id, type: "DEAD_MAN_SWITCH", daysOverdue, executesAt: executesAt.toISOString(), automatic: true },
              },
            });
          });
        }
        results.dms++;
      }
    }

    // 2. Check Inactivity Triggers
    const inactivityTriggers = await prisma.accessTrigger.findMany({
      where: { type: "INACTIVITY", status: "ARMED", inactivityDays: { not: null } },
      include: { user: { select: { id: true, email: true, name: true, updatedAt: true } } },
    });

    for (const trigger of inactivityTriggers) {
      const threshold = new Date(now.getTime() - trigger.inactivityDays! * 24 * 60 * 60 * 1000);
      if (trigger.user.updatedAt > threshold) continue;

      const executesAt = new Date(now.getTime() + trigger.delayDays * 24 * 60 * 60 * 1000);

      if (trigger.delayDays === 0) {
        await prisma.$transaction(async (tx) => {
          await tx.accessTrigger.update({
            where: { id: trigger.id },
            data: { status: "EXECUTED", triggeredAt: now, executesAt: now, executedAt: now },
          });
          await tx.trustee.updateMany({
            where: { grantorId: trigger.userId, status: "ACCEPTED", activatedAt: null },
            data: { activatedAt: now, activatedBy: trigger.id },
          });
          await tx.auditLog.create({
            data: {
              ownerId: trigger.userId,
              actorId: trigger.userId,
              action: "TRIGGER_EXECUTED",
              details: { triggerId: trigger.id, type: "INACTIVITY", inactivityDays: trigger.inactivityDays, automatic: true },
            },
          });
        });
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.accessTrigger.update({
            where: { id: trigger.id },
            data: { status: "TRIGGERED", triggeredAt: now, executesAt },
          });
          await tx.auditLog.create({
            data: {
              ownerId: trigger.userId,
              actorId: trigger.userId,
              action: "TRIGGER_FIRED",
              details: { triggerId: trigger.id, type: "INACTIVITY", inactivityDays: trigger.inactivityDays, executesAt: executesAt.toISOString(), automatic: true },
            },
          });
        });
      }
      results.inactivity++;
    }

    // 3. Promote TRIGGERED triggers whose delay has expired
    const pendingTriggers = await prisma.accessTrigger.findMany({
      where: { status: "TRIGGERED", executesAt: { lte: now } },
    });

    for (const trigger of pendingTriggers) {
      await prisma.$transaction(async (tx) => {
        await tx.accessTrigger.update({
          where: { id: trigger.id },
          data: { status: "EXECUTED", executedAt: now },
        });
        await tx.trustee.updateMany({
          where: { grantorId: trigger.userId, status: "ACCEPTED", activatedAt: null },
          data: { activatedAt: now, activatedBy: trigger.id },
        });
        await tx.auditLog.create({
          data: {
            ownerId: trigger.userId,
            actorId: trigger.userId,
            action: "TRIGGER_EXECUTED",
            details: { triggerId: trigger.id, type: trigger.type, delayExpired: true, automatic: true },
          },
        });
      });
      results.promoted++;
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error("[Cron] Trigger check failed:", error);
    return NextResponse.json({ error: "Trigger check failed" }, { status: 500 });
  }
}
