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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { CreateTaskDependencyDto } from './dto/create-task-dependency.dto';
import {
  TaskDependenciesResponseDto,
  TaskDependencyResponseDto,
} from './dto/task-dependency-response.dto';
import { TaskDependenciesService } from './task-dependencies.service';

@ApiTags('task-dependencies')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, invalido o vencido.' })
@ApiForbiddenResponse({ description: 'El usuario autenticado no tiene permiso sobre la dependencia.' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.USER)
@Controller({ version: '1' })
export class TaskDependenciesController {
  constructor(private readonly taskDependenciesService: TaskDependenciesService) {}

  @Post('tasks/:taskUuid/dependencies')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Crear una dependencia fin a inicio para una actividad sucesora.' })
  @ApiCreatedResponse({ type: TaskDependencyResponseDto })
  @ApiBadRequestResponse({ description: 'Dependencia invalida, duplicada o ciclica.' })
  create(
    @Param('taskUuid', ParseUUIDPipe) taskUuid: string,
    @Body() createDependencyDto: CreateTaskDependencyDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<TaskDependencyResponseDto> {
    return this.taskDependenciesService.create(taskUuid, createDependencyDto, currentUser);
  }

  @Get('tasks/:taskUuid/dependencies')
  @ApiOperation({ summary: 'Listar dependencias entrantes y salientes de una actividad.' })
  @ApiOkResponse({ type: TaskDependenciesResponseDto })
  findByTask(
    @Param('taskUuid', ParseUUIDPipe) taskUuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<TaskDependenciesResponseDto> {
    return this.taskDependenciesService.findByTask(taskUuid, currentUser);
  }

  @Delete('task-dependencies/:uuid')
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una dependencia entre actividades.' })
  @ApiNoContentResponse({ description: 'Dependencia eliminada.' })
  @ApiNotFoundResponse({ description: 'Dependencia no encontrada.' })
  async remove(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.taskDependenciesService.remove(uuid, currentUser);
  }
}
