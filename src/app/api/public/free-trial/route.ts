/**
 * Public endpoint — submit a free trial / scholarship request.
 * No authentication required. Rate limited via middleware.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

const Schema = z.object({
  slug:        z.string().min(1).max(100),
  childName:   z.string().trim().min(2).max(100),
  childAge:    z.number().int().min(3).max(18),
  parentName:  z.string().trim().min(2).max(100),
  parentPhone: z.string().trim().min(6).max(30),
  parentEmail: z.string().email().optional().or(z.literal("")),
  message:     z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => null);
    if (!raw) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const parsed = Schema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.errors.map(e => e.message).join(", ");
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { slug, childName, childAge, parentName, parentPhone, parentEmail, message } = parsed.data;

    const dojo = await prisma.dojo.findUnique({
      where:  { slug, active: true },
      select: { id: true, dojoPage: { select: { published: true, showFreeTrial: true } } },
    });
    if (!dojo?.dojoPage?.published || !dojo.dojoPage.showFreeTrial)
      return NextResponse.json({ error: "Formulario no disponible" }, { status: 404 });

    // Auto-suggest a schedule based on age:
    // 3–7  → first morning schedule (startTime < "12:00")
    // 8–12 → first afternoon schedule
    // 13+  → first evening schedule
    const schedules = await prisma.schedule.findMany({
      where:   { dojoId: dojo.id, active: true },
      select:  { id: true, startTime: true },
      orderBy: { startTime: "asc" },
    });

    let suggestedScheduleId: string | null = null;
    if (schedules.length > 0) {
      if (childAge <= 7) {
        suggestedScheduleId = schedules.find(s => s.startTime < "12:00")?.id ?? schedules[0].id;
      } else if (childAge <= 12) {
        suggestedScheduleId = schedules.find(s => s.startTime >= "12:00" && s.startTime < "17:00")?.id
          ?? schedules[0].id;
      } else {
        suggestedScheduleId = schedules.find(s => s.startTime >= "17:00")?.id ?? schedules[0].id;
      }
    }

    const request = await prisma.freeTrialRequest.create({
      data: {
        dojoId:      dojo.id,
        childName,
        childAge,
        parentName,
        parentPhone,
        parentEmail: parentEmail || null,
        message:     message || null,
        scheduleId:  suggestedScheduleId,
        status:      "pending",
        read:        false,
      },
      select: { id: true, childName: true, childAge: true },
    });

    return NextResponse.json({ ok: true, id: request.id }, { status: 201 });
  } catch (err) {
    console.error("[free-trial] POST error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
