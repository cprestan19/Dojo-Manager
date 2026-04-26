import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import StudentForm from "@/components/students/StudentForm";

export default async function EditStudentPage({ params }: { params: { id: string } }) {
  const student = await prisma.student.findUnique({
    where: { id: params.id },
    include: { inscription: true },
  });

  if (!student) notFound();

  const formValues = {
    id:          student.id,
    firstName:   student.firstName,
    lastName:    student.lastName,
    photo:       student.photo,
    birthDate:   student.birthDate.toISOString(),
    gender:      student.gender,
    nationality: student.nationality,
    allergy1:    student.allergy1 ?? "",
    allergy2:    student.allergy2 ?? "",
    hasPrivateInsurance: student.hasPrivateInsurance,
    insuranceName:  student.insuranceName ?? "",
    motherName:     student.motherName  ?? "",
    motherPhone:    student.motherPhone ?? "",
    motherEmail:    student.motherEmail ?? "",
    fatherName:     student.fatherName  ?? "",
    fatherPhone:    student.fatherPhone ?? "",
    fatherEmail:    student.fatherEmail ?? "",
    auxContactName:  student.auxContactName  ?? "",
    auxContactPhone: student.auxContactPhone ?? "",
    address: student.address ?? "",
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
