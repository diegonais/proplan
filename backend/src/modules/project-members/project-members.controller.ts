import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
import { CreateProjectMemberDto } from './dto/create-project-member.dto';
import { ProjectMemberCandidateResponseDto } from './dto/project-member-candidate-response.dto';
import { ProjectMemberResponseDto } from './dto/project-member-response.dto';
import { WorkloadQueryDto } from './dto/workload-query.dto';
import { WorkloadItemResponseDto } from './dto/workload-response.dto';
import { ProjectMembersService } from './project-members.service';

@ApiTags('project members')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, invalido o vencido.' })
@ApiForbiddenResponse({ description: 'El usuario autenticado no tiene permiso sobre el equipo.' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
@Controller({ version: '1' })
export class ProjectMembersController {
  constructor(private readonly projectMembersService: ProjectMembersService) {}

  @Post('projects/:projectUuid/members')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Agregar un usuario activo como miembro de un proyecto.' })
  @ApiCreatedResponse({ type: ProjectMemberResponseDto })
  @ApiBadRequestResponse({ description: 'Usuario inexistente, inactivo o regla de negocio incumplida.' })
  @ApiConflictResponse({ description: 'El usuario ya pertenece al proyecto.' })
  create(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @Body() createProjectMemberDto: CreateProjectMemberDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ProjectMemberResponseDto> {
    return this.projectMembersService.create(projectUuid, createProjectMemberDto, currentUser);
  }

  @Get('projects/:projectUuid/members')
  @ApiOperation({ summary: 'Listar miembros y horas asignadas del proyecto autorizado.' })
  @ApiOkResponse({ type: [ProjectMemberResponseDto] })
  findAll(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ProjectMemberResponseDto[]> {
    return this.projectMembersService.findAll(projectUuid, currentUser);
  }

  @Get('projects/:projectUuid/member-candidates')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Listar usuarios activos disponibles para agregar al proyecto.' })
  @ApiOkResponse({ type: [ProjectMemberCandidateResponseDto] })
  findCandidates(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ProjectMemberCandidateResponseDto[]> {
    return this.projectMembersService.findCandidates(projectUuid, currentUser);
  }

  @Delete('projects/:projectUuid/members/:userUuid')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Retirar un miembro sin eliminar automaticamente asignaciones activas.' })
  @ApiNoContentResponse({ description: 'Miembro retirado.' })
  @ApiBadRequestResponse({ description: 'El miembro es jefe del proyecto o tiene asignaciones activas.' })
  @ApiNotFoundResponse({ description: 'Miembro no encontrado.' })
  async remove(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @Param('userUuid', ParseUUIDPipe) userUuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.projectMembersService.remove(projectUuid, userUuid, currentUser);
  }

  @Get('projects/:projectUuid/workload')
  @ApiOperation({ summary: 'Consultar carga de trabajo por persona como suma de horas asignadas.' })
  @ApiOkResponse({ type: [WorkloadItemResponseDto] })
  getWorkload(
    @Param('projectUuid', ParseUUIDPipe) projectUuid: string,
    @Query() query: WorkloadQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<WorkloadItemResponseDto[]> {
    return this.projectMembersService.getWorkload(projectUuid, currentUser, query.userUuid);
  }
}
