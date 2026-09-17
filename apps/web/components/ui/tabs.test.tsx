import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

describe('Tabs', () => {
  it('mostra o conteúdo da aba ativa e troca ao clicar', async () => {
    render(
      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="endereco">Endereço</TabsTrigger>
        </TabsList>
        <TabsContent value="dados">Conteúdo de dados</TabsContent>
        <TabsContent value="endereco">Conteúdo de endereço</TabsContent>
      </Tabs>
    );

    expect(screen.getByText('Conteúdo de dados')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Endereço' }));

    expect(screen.getByText('Conteúdo de endereço')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Endereço' })).toHaveAttribute('data-state', 'active');
  });
});