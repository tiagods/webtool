import * as React from 'react';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import { render } from '@testing-library/react';
import type { AberturaFormValues } from '@prolink/shared';

export interface AberturaHarnessProps {
  defaultValues?: Partial<AberturaFormValues>;
  onReady?: (methods: UseFormReturn<AberturaFormValues>) => void;
  children: React.ReactNode;
}

export function AberturaHarness({ defaultValues, onReady, children }: AberturaHarnessProps) {
  const methods = useForm<AberturaFormValues>({
    defaultValues: defaultValues as AberturaFormValues,
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

export function renderStep(
  ui: React.ReactElement,
  options: Omit<AberturaHarnessProps, 'children'> = {}
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <AberturaHarness defaultValues={options.defaultValues} onReady={options.onReady}>
        {children}
      </AberturaHarness>
    ),
  });
}

export function lerEstado(): AberturaFormValues {
  const node = document.querySelector('[data-testid="harness-state"]');
  return JSON.parse(node?.textContent ?? '{}') as AberturaFormValues;
}