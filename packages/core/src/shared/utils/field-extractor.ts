/**
 * FieldExtractor — THE single source of truth for GitHub Projects V2 field value extraction.
 *
 * Extraction priority: text || name || value
 * Case-insensitive field name matching.
 */

export interface FieldValue {
  readonly field?: {
    readonly name?: string;
    readonly id?: string;
  };
  readonly text?: string;
  readonly name?: string;
  readonly value?: string;
  readonly number?: number;
  readonly date?: string;
  readonly optionId?: string;
}

export interface CommonFields {
  readonly status: string | undefined;
  readonly containers: Record<string, string>;
  readonly dependencies: string | undefined;
  readonly aiSuitability: string | undefined;
  readonly riskLevel: string | undefined;
  readonly effort: string | undefined;
  readonly aiContext: string | undefined;
}

/**
 * Static utility class for extracting field values from GitHub Projects V2 API responses.
 */
export class FieldExtractor {
  /**
   * Extract a single text field value by field name (case-insensitive).
   * Priority: text || name || value
   */
  static getFieldValue(fieldValues: readonly FieldValue[], fieldName: string): string | undefined {
    const field = FieldExtractor.findField(fieldValues, fieldName);
    if (!field) return undefined;
    return field.text ?? field.name ?? field.value ?? undefined;
  }

  /** Extract a numeric field value by field name (case-insensitive). */
  static getNumericFieldValue(fieldValues: readonly FieldValue[], fieldName: string): number | undefined {
    const field = FieldExtractor.findField(fieldValues, fieldName);
    return field?.number ?? undefined;
  }

  /** Extract a date field value by field name (case-insensitive). */
  static getDateFieldValue(fieldValues: readonly FieldValue[], fieldName: string): string | undefined {
    const field = FieldExtractor.findField(fieldValues, fieldName);
    return field?.date ?? undefined;
  }

  /** Extract multiple field values at once. */
  static getMultipleFieldValues(
    fieldValues: readonly FieldValue[],
    fieldNames: readonly string[],
  ): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};
    for (const name of fieldNames) {
      result[name] = FieldExtractor.getFieldValue(fieldValues, name);
    }
    return result;
  }

  /** Check if a field has a non-empty value. */
  static hasFieldValue(fieldValues: readonly FieldValue[], fieldName: string): boolean {
    const value = FieldExtractor.getFieldValue(fieldValues, fieldName);
    return value !== undefined && value !== '';
  }

  /** Get all unique field names from the field values array. */
  static getFieldNames(fieldValues: readonly FieldValue[]): string[] {
    const names = new Set<string>();
    for (const fv of fieldValues) {
      if (fv.field?.name) {
        names.add(fv.field.name);
      }
    }
    return [...names];
  }

  /** Extract all common project fields into a typed object. */
  static extractCommonFields(fieldValues: readonly FieldValue[]): CommonFields {
    const wave = FieldExtractor.getFieldValue(fieldValues, 'Wave');
    const epic = FieldExtractor.getFieldValue(fieldValues, 'Epic');
    const containers: Record<string, string> = {};
    if (wave) containers['wave'] = wave;
    if (epic) containers['epic'] = epic;

    return {
      status: FieldExtractor.getFieldValue(fieldValues, 'Status'),
      containers,
      dependencies: FieldExtractor.getFieldValue(fieldValues, 'Dependencies'),
      aiSuitability: FieldExtractor.getFieldValue(fieldValues, 'AI Suitability'),
      riskLevel: FieldExtractor.getFieldValue(fieldValues, 'Risk Level'),
      effort: FieldExtractor.getFieldValue(fieldValues, 'Effort'),
      aiContext: FieldExtractor.getFieldValue(fieldValues, 'AI Context'),
    };
  }

  /** Find a field by name (case-insensitive). */
  private static findField(fieldValues: readonly FieldValue[], fieldName: string): FieldValue | undefined {
    const lowerName = fieldName.toLowerCase();
    return fieldValues.find((fv) => fv.field?.name?.toLowerCase() === lowerName);
  }
}
