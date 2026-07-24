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
  Query,
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
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { PaginatedProjectsResponseDto } from './dto/paginated-projects-response.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente, invalido o vencido.' })
@ApiForbiddenResponse({ description: 'El usuario autenticado no tiene permiso sobre el proyecto.' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.USER)
@Controller({
  path: 'projects',
  version: '1',
})
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Crear un proyecto y registrar al jefe como miembro inicial.' })
  @ApiCreatedResponse({ type: ProjectResponseDto })
  @ApiBadRequestResponse({ description: 'Datos invalidos, fechas incorrectas o jefe no valido.' })
  create(
    @Body() createProjectDto: CreateProjectDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.create(createProjectDto, currentUser);
  }

  @Get()
  @ApiOperation({ summary: 'Listar proyectos con paginacion, filtros, busqueda y permisos por rol.' })
  @ApiOkResponse({ type: PaginatedProjectsResponseDto })
  findAll(
    @Query() query: ListProjectsQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedProjectsResponseDto> {
    return this.projectsService.findAll(query, currentUser);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Consultar el detalle de un proyecto por UUID.' })
  @ApiOkResponse({ type: ProjectResponseDto })
  @ApiNotFoundResponse({ description: 'Proyecto no encontrado o eliminado.' })
  findOne(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.findOne(uuid, currentUser);
  }

  @Patch(':uuid')
  @ApiOperation({ summary: 'Actualizar datos generales de un proyecto autorizado.' })
  @ApiOkResponse({ type: ProjectResponseDto })
  @ApiBadRequestResponse({ description: 'Datos invalidos, fechas incorrectas o jefe no valido.' })
  @ApiNotFoundResponse({ description: 'Proyecto no encontrado o eliminado.' })
  update(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.update(uuid, updateProjectDto, currentUser);
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar logicamente un proyecto autorizado.' })
  @ApiNoContentResponse({ description: 'Proyecto eliminado logicamente.' })
  @ApiNotFoundResponse({ description: 'Proyecto no encontrado o eliminado.' })
  async remove(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.projectsService.remove(uuid, currentUser);
  }
}
