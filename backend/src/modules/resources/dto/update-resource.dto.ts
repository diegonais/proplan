import { PartialType, OmitType } from '@nestjs/swagger';

import { CreateResourceDto } from './create-resource.dto';

export class UpdateResourceDto extends PartialType(
  OmitType(CreateResourceDto, ['operationalStatus'] as const),
) {}
