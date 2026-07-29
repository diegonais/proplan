import { Controller, Get, Param, ParseUUIDPipe, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ProjectFinancialSummaryResponseDto } from '../finances/dto/financial-summary-response.dto';
import { DashboardReportResponseDto } from './dto/dashboard-report-response.dto';
import { GanttReportResponseDto } from './dto/gantt-report-response.dto';
import { ProjectStatusReportResponseDto } from './dto/project-status-report-response.dto';
import { ResourceUtilizationReportResponseDto } from './dto/resource-utilization-report-response.dto';
import {
  TrafficLightReportResponseDto,
  WorkloadReportItemResponseDto,
} from './dto/report-common.dto';
import { ExportsService, GeneratedExportFile } from './exports.service';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, invalido o vencido.' })
@ApiForbiddenResponse({ description: 'El usuario autenticado no tiene permiso para el reporte.' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
@Controller({ version: '1' })
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly exportsService: ExportsService,
  ) {}

  @Get('reports/dashboard')
  @ApiOperation({ summary: 'Consultar resumen del dashboard filtrado por rol.' })
  @ApiOkResponse({ type: DashboardReportResponseDto })
  getDashboard(@CurrentUser() currentUser: AuthenticatedUser): Promise<DashboardReportResponseDto> {
    return this.reportsService.getDashboard(currentUser);
  }

  @Get('projects/:projectUuid/reports/gantt')
  @ApiOperation({ summary: 'Consultar datos de Gantt del proyecto.' })
  @ApiOkResponse({ type: GanttReportResponseDto })
  @ApiNotFoundResponse({ description: 'Proyecto no encontrado o eliminado.' })
  getProjectGantt(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<GanttReportResponseDto> {
    return this.reportsService.getProjectGantt(projectUuid, currentUser);
  }

  @Get('projects/:projectUuid/reports/workload')
  @ApiOperation({ summary: 'Consultar carga de trabajo humana por persona del proyecto.' })
  @ApiOkResponse({ type: [WorkloadReportItemResponseDto] })
  @ApiNotFoundResponse({ description: 'Proyecto no encontrado o eliminado.' })
  getProjectWorkload(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WorkloadReportItemResponseDto[]> {
    return this.reportsService.getProjectWorkload(projectUuid, currentUser);
  }

  @Get('projects/:projectUuid/reports/resource-utilization')
  @ApiOperation({ summary: 'Consultar utilizacion de recursos no humanos del proyecto.' })
  @ApiOkResponse({ type: ResourceUtilizationReportResponseDto })
  @ApiNotFoundResponse({ description: 'Proyecto no encontrado o eliminado.' })
  getProjectResourceUtilization(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ResourceUtilizationReportResponseDto> {
    return this.reportsService.getProjectResourceUtilization(projectUuid, currentUser);
  }

  @Get('projects/:projectUuid/reports/budget')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Consultar presupuesto versus costo real del proyecto.' })
  @ApiOkResponse({ type: ProjectFinancialSummaryResponseDto })
  @ApiNotFoundResponse({ description: 'Proyecto no encontrado o eliminado.' })
  getProjectBudget(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ProjectFinancialSummaryResponseDto> {
    return this.reportsService.getProjectBudget(projectUuid, currentUser);
  }

  @Get('projects/:projectUuid/reports/traffic-light')
  @ApiOperation({ summary: 'Consultar semaforo calculado del proyecto con razones.' })
  @ApiOkResponse({ type: TrafficLightReportResponseDto })
  @ApiNotFoundResponse({ description: 'Proyecto no encontrado o eliminado.' })
  getProjectTrafficLight(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<TrafficLightReportResponseDto> {
    return this.reportsService.getProjectTrafficLight(projectUuid, currentUser);
  }

  @Get('projects/:projectUuid/reports/status')
  @ApiOperation({ summary: 'Consultar estado general calculado del proyecto.' })
  @ApiOkResponse({ type: ProjectStatusReportResponseDto })
  @ApiNotFoundResponse({ description: 'Proyecto no encontrado o eliminado.' })
  getProjectStatus(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ProjectStatusReportResponseDto> {
    return this.reportsService.getProjectStatus(projectUuid, currentUser);
  }

  @Get('projects/:projectUuid/exports/pdf')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Exportar reporte completo del proyecto en PDF.' })
  @ApiOkResponse({ description: 'Archivo PDF generado en memoria.' })
  @ApiNotFoundResponse({ description: 'Proyecto no encontrado o eliminado.' })
  async exportProjectPdf(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.exportsService.generateProjectPdf(projectUuid, currentUser);

    sendGeneratedFile(response, file);
  }

  @Get('projects/:projectUuid/exports/excel')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Exportar reporte completo del proyecto en Excel.' })
  @ApiOkResponse({ description: 'Archivo XLSX generado en memoria.' })
  @ApiNotFoundResponse({ description: 'Proyecto no encontrado o eliminado.' })
  async exportProjectExcel(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.exportsService.generateProjectExcel(projectUuid, currentUser);

    sendGeneratedFile(response, file);
  }
}

function sendGeneratedFile(response: Response, file: GeneratedExportFile): void {
  response.setHeader('Content-Type', file.contentType);
  response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
  response.setHeader('Content-Length', file.buffer.length.toString());
  response.send(file.buffer);
}
