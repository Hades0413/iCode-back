import { ApiProperty } from '@nestjs/swagger';

/** "Exámenes y documentos" de la ficha — muchos por paciente, ver PatientAttachment. */
export class PatientAttachmentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  fileSize: number;

  @ApiProperty({ description: 'Nombre resuelto de quien lo subió' })
  uploadedBy: string;

  @ApiProperty()
  uploadedAt: string;
}
