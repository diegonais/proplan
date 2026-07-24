import { ProjectStatus } from '../../common/enums/project-status.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import {
  calculateTrafficLight,
  getTodayInLaPaz,
  TrafficLightColor,
} from './reports-calculations';

describe('reports traffic light calculations', () => {
  it('returns green when there are no overdue tasks, consumption is below 80 percent and the project is not overdue', () => {
    const result = calculateTrafficLight(
      createProject({ approvedBudget: '1000.00', endDate: '2026-08-30' }),
      [createTask({ endDate: '2026-08-10', progress: 50, actualCost: '500.00' })],
      '2026-07-24',
    );

    expect(result.color).toBe(TrafficLightColor.GREEN);
    expect(result.reasons).toEqual([
      'No existen actividades vencidas, el consumo es inferior a 80% y el proyecto no esta vencido.',
    ]);
    expect(result.consumedPercentage).toBe('50.00');
  });

  it('returns yellow when budget consumption is between 80 and 100 percent', () => {
    const result = calculateTrafficLight(
      createProject({ approvedBudget: '1000.00' }),
      [createTask({ actualCost: '800.00' })],
      '2026-07-24',
    );

    expect(result.color).toBe(TrafficLightColor.YELLOW);
    expect(result.reasons).toContain('El consumo del presupuesto esta entre 80% y 100%.');
  });

  it('returns yellow when at least one task is overdue but less than 30 percent are overdue', () => {
    const result = calculateTrafficLight(
      createProject({ approvedBudget: '1000.00' }),
      [
        createTask({ uuid: 'task-1', endDate: '2026-07-23', progress: 20 }),
        createTask({ uuid: 'task-2', endDate: '2026-08-01', progress: 0 }),
        createTask({ uuid: 'task-3', endDate: '2026-08-02', progress: 0 }),
        createTask({ uuid: 'task-4', endDate: '2026-08-03', progress: 0 }),
      ],
      '2026-07-24',
    );

    expect(result.color).toBe(TrafficLightColor.YELLOW);
    expect(result.overdueTasksPercentage).toBe('25.00');
    expect(result.overdueTasksCount).toBe(1);
  });

  it('returns red when actual cost exceeds approved budget', () => {
    const result = calculateTrafficLight(
      createProject({ approvedBudget: '1000.00' }),
      [createTask({ actualCost: '1000.01' })],
      '2026-07-24',
    );

    expect(result.color).toBe(TrafficLightColor.RED);
    expect(result.reasons).toContain('El costo ejecutado supera el presupuesto aprobado.');
  });

  it('returns red when the project is overdue and not completed or cancelled', () => {
    const result = calculateTrafficLight(
      createProject({ endDate: '2026-07-23', status: ProjectStatus.IN_PROGRESS }),
      [],
      '2026-07-24',
    );

    expect(result.color).toBe(TrafficLightColor.RED);
    expect(result.isProjectOverdue).toBe(true);
  });

  it('returns red when overdue tasks are at least 30 percent of active non cancelled tasks', () => {
    const result = calculateTrafficLight(
      createProject(),
      [
        createTask({ uuid: 'task-1', endDate: '2026-07-20', progress: 10 }),
        createTask({ uuid: 'task-2', endDate: '2026-08-01' }),
        createTask({ uuid: 'task-3', endDate: '2026-08-02' }),
      ],
      '2026-07-24',
    );

    expect(result.color).toBe(TrafficLightColor.RED);
    expect(result.overdueTasksPercentage).toBe('33.33');
  });

  it('handles approved budget equal to zero without division by zero', () => {
    const noCost = calculateTrafficLight(
      createProject({ approvedBudget: '0.00' }),
      [createTask({ actualCost: '0.00' })],
      '2026-07-24',
    );
    const withCost = calculateTrafficLight(
      createProject({ approvedBudget: '0.00' }),
      [createTask({ actualCost: '0.01' })],
      '2026-07-24',
    );

    expect(noCost.consumedPercentage).toBe('0.00');
    expect(noCost.color).toBe(TrafficLightColor.GREEN);
    expect(withCost.consumedPercentage).toBe('100.00');
    expect(withCost.color).toBe(TrafficLightColor.RED);
  });

  it('handles projects without tasks', () => {
    const result = calculateTrafficLight(createProject({ approvedBudget: '0.00' }), [], '2026-07-24');

    expect(result.color).toBe(TrafficLightColor.GREEN);
    expect(result.activeNonCancelledTasksCount).toBe(0);
    expect(result.overdueTasksPercentage).toBe('0.00');
  });

  it('uses America La Paz calendar date for today', () => {
    expect(getTodayInLaPaz(new Date('2026-07-25T03:30:00.000Z'))).toBe('2026-07-24');
    expect(getTodayInLaPaz(new Date('2026-07-25T04:30:00.000Z'))).toBe('2026-07-25');
  });
});

function createProject(overrides: Partial<Parameters<typeof calculateTrafficLight>[0]> = {}) {
  return {
    uuid: 'project-1',
    endDate: '2026-08-31',
    status: ProjectStatus.IN_PROGRESS,
    approvedBudget: '1000.00',
    ...overrides,
  };
}

function createTask(overrides: Partial<Parameters<typeof calculateTrafficLight>[1][number]> = {}) {
  return {
    uuid: 'task-1',
    name: 'Actividad',
    endDate: '2026-08-15',
    status: TaskStatus.IN_PROGRESS,
    progress: 0,
    actualCost: '0.00',
    ...overrides,
  };
}
