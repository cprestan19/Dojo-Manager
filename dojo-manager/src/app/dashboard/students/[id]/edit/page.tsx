import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import StudentForm from "@/components/students/StudentForm";

type SessionUser = { dojoId?: string | null };

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }    = await params;
  const session   = await getServerSession(authOptions);
  const { dojoId } = (session?.user as SessionUser) ?? {};

  const student = await prisma.student.findUnique({
    where: dojoId ? { id, dojoId } : { id },
    include: { inscription: true },
  });

  if (!student) notFound();

  const formValues = {
    id:          student.id,
    studentCode: student.studentCode,
    fullName:    `${student.firstName} ${student.lastName}`.trim(),
    cedula:      student.cedula      ?? "",
    fepakaId:    student.fepakaId    ?? "",
    ryoBukaiId:  student.ryoBukaiId  ?? "",
    photo:       student.photo,
    birthDate:   student.birthDate.toISOString(),
    gender:      student.gender,
    nationality: student.nationality,
    condition:       student.condition       ?? "",
    bloodType:       student.bloodType       ?? "",
    hasPrivateInsurance: student.hasPrivateInsurance,
    insuranceName:   student.insuranceName   ?? "",
    insuranceNumber: student.insuranceNumber ?? "",
    motherName:      student.motherName      ?? "",
    motherPhone:     student.motherPhone     ?? "",
    motherEmail:     student.motherEmail     ?? "",
    fatherName:      student.fatherName      ?? "",
    fatherPhone:     student.fatherPhone     ?? "",
    fatherEmail:     student.fatherEmail     ?? "",
    address:         student.address         ?? "",
    inscription: student.inscription ? {
      inscriptionDate:   student.inscription.inscriptionDate.toISOString(),
      annualPaymentDate: student.inscription.annualPaymentDate?.toISOString() ?? "",
      annualAmount:      String(student.inscription.annualAmount),
      monthlyAmount:     String(student.inscription.monthlyAmount),
      discountAmount:    String(student.inscription.discountAmount),
      discountNote:      student.inscription.discountNote ?? "",
    } : undefined,
  };

  return <StudentForm defaultValues={formValues} isEdit />;
}
