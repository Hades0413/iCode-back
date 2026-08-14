import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsString, Length, Matches } from 'class-validator';

/**
 * Lo que el paciente escribe cuando consiguió su cita por su cuenta, sin
 * esperar a que la posta se la asigne — ver JourneyService.reportAppointment.
 */
export class ReportAppointmentDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  hospital: string;

  @ApiProperty({ description: 'Fecha, "YYYY-MM-DD"' })
  @IsISO8601({ strict: true })
  date: string;

  @ApiProperty({ description: 'Hora, "HH:mm"' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'time debe tener el formato HH:mm',
  })
  time: string;

  @ApiProperty()
  @IsString()
  @Length(1, 150)
  doctor: string;
}
