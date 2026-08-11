import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional } from 'class-validator';
import { RelationshipType } from '../../../domain/enums/relationship-type.enum';

export class CreateLegalGuardianDto {
  @ApiProperty({
    description:
      'Id del usuario (ya registrado) que actuará como tutor — su nombre/documento se leen de "User", no se duplican aquí',
  })
  @IsInt()
  userId: number;

  @ApiProperty({ enum: RelationshipType })
  @IsEnum(RelationshipType)
  relationshipType: RelationshipType;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
