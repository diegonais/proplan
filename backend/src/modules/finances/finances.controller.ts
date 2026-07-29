import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ProjectResponseDto } from '../projects/dto/project-response.dto';
import { TaskResponseDto } from '../tasks/dto/task-response.dto';
import { ProjectFinancialSummaryResponseDto } from './dto/financial-summary-response.dto';
import { UpdateProjectBudgetDto } from './dto/update-project-budget.dto';
import { UpdateTaskFinancialsDto } from './dto/update-task-financials.dto';
import { FinancesService } from './finances.service';

@ApiTags('finances')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, invalido o vencido.' })
@ApiForbiddenResponse({ description: 'El usuario autenticado no tiene permiso financiero.' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
@Controller({ version: '1' })
export class FinancesController {
  constructor(private readonly financesService: FinancesService) {}

  @Get('projects/:projectUuid/financial-summary')
  @ApiOperation({
    summary: 'Consultar resumen financiero calculado del proyecto.',
    description:
      'Los montos se devuelven como strings decimales. Se excluyen actividades eliminadas logicamente y CANCELLED.',
  })
  @ApiOkResponse({ type: ProjectFinancialSummaryResponseDto })
  @ApiNotFoundResponse({ description: 'Proyecto no encontrado o eliminado.' })
  getProjectFinancialSummary(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ProjectFinancialSummaryResponseDto> {
    return this.financesService.getProjectFinancialSummary(projectUuid, currentUser);
  }

  @Patch('projects/:projectUuid/budget')
  @ApiOperation({ summary: 'Actualizar solamente el presupuesto aprobado del proyecto.' })
  @ApiOkResponse({ type: ProjectResponseDto })
  @ApiBadRequestResponse({
    description: 'Monto invalido, negativo o menor al presupuesto ya distribuido en actividades.',
  })
  @ApiNotFoundResponse({ description: 'Proyecto no encontrado o eliminado.' })
  updateProjectBudget(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @Body() updateProjectBudgetDto: UpdateProjectBudgetDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ProjectResponseDto> {
    return this.financesService.updateProjectBudget(projectUuid, updateProjectBudgetDto, currentUser);
  }

  @Patch('tasks/:taskUuid/financials')
  @ApiOperation({ summary: 'Actualizar presupuesto planificado y costo ejecutado de una actividad.' })
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiBadRequestResponse({
    description:
      'Montos invalidos, negativos, cuerpo vacio o presupuesto planificado superior al aprobado.',
  })
  @ApiNotFoundResponse({ description: 'Actividad no encontrada o eliminada.' })
  updateTaskFinancials(
    @Param('taskUuid', ParseUUIDPipe) taskUuid: string,
    @Body() updateTaskFinancialsDto: UpdateTaskFinancialsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<TaskResponseDto> {
    return this.financesService.updateTaskFinancials(taskUuid, updateTaskFinancialsDto, currentUser);
  }
}
