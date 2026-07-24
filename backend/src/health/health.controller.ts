import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

interface HealthResponse {
  status: 'ok';
  service: 'proplan-api';
  timestamp: string;
  timeZone: 'America/La_Paz';
}

@ApiTags('technical')
@Controller({
  path: 'health',
  version: '1',
})
export class HealthController {
  @Get()
  @ApiOkResponse({ description: 'Confirms that the API process is running.' })
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'proplan-api',
      timestamp: new Date().toISOString(),
      timeZone: 'America/La_Paz',
    };
  }
}
