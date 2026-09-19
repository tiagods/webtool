import * as React from 'react';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import { render } from '@testing-library/react';
import type { AlteracaoFormValues } from '@prolink/shared';

export interface AlteracaoHarnessProps {
  defaultValues?: Partial<AlteracaoFormValues>;
  onReady?: (methods: UseFormReturn<AlteracaoFormValues>) => void;
  children: React.ReactNode;
}

export function AlteracaoHarness({ defaultValues, onReady, children }: AlteracaoHarnessProps) {
  const methods = useForm<AlteracaoFormValues>({
    defaultValues: defaultValues as AlteracaoFormValues,
  });

  React.useEffect(() => {
    onReady?.(methods);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FormProvider {...methods}>
      {children}
      <pre data-testid="harness-state">{JSON.stringify(methods.watch())}</pre>
      <button type="button" data-testid="harness-trigger" onClick={() => methods.trigger()}>
        trigger
      </button>
    </FormProvider>
  );
}

export function renderAlteracao(
  ui: React.ReactElement,
  options: Omit<AlteracaoHarnessProps, 'children'> = {}
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <AlteracaoHarness defaultValues={options.defaultValues} onReady={options.onReady}>
        {children}
      </AlteracaoHarness>
    ),
  });
}

export function lerEstadoAlteracao(): AlteracaoFormValues {
  const node = document.querySelector('[data-testid="harness-state"]');
  return JSON.parse(node?.textContent ?? '{}') as AlteracaoFormValues;
}