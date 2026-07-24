import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns the technical health status', () => {
    const controller = new HealthController();

    expect(controller.check()).toMatchObject({
      status: 'ok',
      service: 'proplan-api',
      timeZone: 'America/La_Paz',
    });
  });
});
