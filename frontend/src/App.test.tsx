import { render, screen } from '@testing-library/react';

import { App } from './App';

describe('App', () => {
  it('renders the bootstrap status page', () => {
    render(<App />);

    expect(screen.getByText('Aplicacion inicializada correctamente')).toBeInTheDocument();
  });
});
