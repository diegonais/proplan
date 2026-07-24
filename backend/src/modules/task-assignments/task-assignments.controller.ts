import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { CreateTaskAssignmentDto } from './dto/create-task-assignment.dto';
import { SetMainResponsibleDto } from './dto/set-main-responsible.dto';
import { TaskAssignmentResponseDto } from './dto/task-assignment-response.dto';
import { UpdateTaskAssignmentDto } from './dto/update-task-assignment.dto';
import { TaskAssignmentsService } from './task-assignments.service';

@ApiTags('task assignments')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, invalido o vencido.' })
@ApiForbiddenResponse({ description: 'El usuario autenticado no tiene permiso sobre la asignacion.' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.USER)
@Controller({ version: '1' })
export class TaskAssignmentsController {
  constructor(private readonly taskAssignmentsService: TaskAssignmentsService) {}

  @Post('tasks/:taskUuid/assignments')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Asignar un miembro activo del proyecto a una actividad.' })
  @ApiCreatedResponse({ type: TaskAssignmentResponseDto })
  @ApiBadRequestResponse({ description: 'Usuario inactivo, no miembro o regla incumplida.' })
  @ApiConflictResponse({ description: 'Asignacion duplicada.' })
  create(
    @Param('taskUuid', ParseUUIDPipe) taskUuid: string,
    @Body() createTaskAssignmentDto: CreateTaskAssignmentDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<TaskAssignmentResponseDto> {
    return this.taskAssignmentsService.create(taskUuid, createTaskAssignmentDto, currentUser);
  }

  @Get('tasks/:taskUuid/assignments')
  @ApiOperation({ summary: 'Listar usuarios asignados a una actividad autorizada.' })
  @ApiOkResponse({ type: [TaskAssignmentResponseDto] })
  findAll(
    @Param('taskUuid', ParseUUIDPipe) taskUuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<TaskAssignmentResponseDto[]> {
    return this.taskAssignmentsService.findAll(taskUuid, currentUser);
  }

  @Patch('task-assignments/:uuid')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Actualizar horas asignadas sin cambiar responsable principal.' })
  @ApiOkResponse({ type: TaskAssignmentResponseDto })
  @ApiBadRequestResponse({ description: 'Horas invalidas.' })
  @ApiNotFoundResponse({ description: 'Asignacion no encontrada.' })
  update(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() updateTaskAssignmentDto: UpdateTaskAssignmentDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<TaskAssignmentResponseDto> {
    return this.taskAssignmentsService.update(uuid, updateTaskAssignmentDto, currentUser);
  }

  @Delete('task-assignments/:uuid')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una asignacion de actividad de forma explicita.' })
  @ApiNoContentResponse({ description: 'Asignacion eliminada.' })
  @ApiNotFoundResponse({ description: 'Asignacion no encontrada.' })
  async remove(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.taskAssignmentsService.remove(uuid, currentUser);
  }

  @Patch('tasks/:taskUuid/main-responsible')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Cambiar responsable principal de una actividad en una transaccion.' })
  @ApiOkResponse({ type: TaskAssignmentResponseDto })
  @ApiBadRequestResponse({ description: 'El usuario no esta asignado o no pertenece al proyecto.' })
  setMainResponsible(
    @Param('taskUuid', ParseUUIDPipe) taskUuid: string,
    @Body() setMainResponsibleDto: SetMainResponsibleDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<TaskAssignmentResponseDto> {
    return this.taskAssignmentsService.setMainResponsible(
      taskUuid,
      setMainResponsibleDto.userUuid,
      currentUser,
    );
  }
}
