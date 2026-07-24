declare module 'class-transformer' {
  export interface TransformFnParams {
    value: unknown;
    key: string;
    obj: unknown;
    type: unknown;
    options: unknown;
  }

  export function Transform(
    transformFn: (params: TransformFnParams) => unknown,
  ): PropertyDecorator;

  export function Type(typeFunction?: (type?: unknown) => unknown): PropertyDecorator;
}
