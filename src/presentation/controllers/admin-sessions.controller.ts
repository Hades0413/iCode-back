import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SessionStatsService } from '../../application/services/session-stats.service';
import { OnlineUsersResponseDto } from '../../application/dto/online-user.dto';
import { RequirePermission } from '../decorators/require-permission.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/sessions')
export class AdminSessionsController {
  constructor(private readonly sessionStats: SessionStatsService) {}

  @Get('online')
  @RequirePermission('ADMIN_VIEW_SESSIONS')
  @ApiOperation({
    summary:
      'Usuarios en línea ahora mismo (actividad reciente) + ubicación aproximada por IP',
  })
  @ApiOkResponse({ type: OnlineUsersResponseDto })
  getOnlineUsers(): Promise<OnlineUsersResponseDto> {
    return this.sessionStats.getOnlineUsers();
  }
}
