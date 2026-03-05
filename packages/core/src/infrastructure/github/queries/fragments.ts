/**
 * Shared GraphQL fragments for GitHub ProjectV2 API queries.
 *
 * Single source of truth — used by all query files to avoid duplication.
 */

/** Field value extraction for ProjectV2 items */
export const FIELD_VALUES_FRAGMENT = `
  fieldValues(first: 20) {
    nodes {
      ... on ProjectV2ItemFieldTextValue {
        field {
          ... on ProjectV2FieldCommon {
            id
            name
          }
        }
        text
      }
      ... on ProjectV2ItemFieldSingleSelectValue {
        field {
          ... on ProjectV2FieldCommon {
            id
            name
          }
        }
        name
        id
      }
      ... on ProjectV2ItemFieldNumberValue {
        field {
          ... on ProjectV2FieldCommon {
            id
            name
          }
        }
        number
      }
    }
  }
`;
