/**
 * Zod schemas for epic-related MCP tool inputs.
 */

import { z } from 'zod';

export const SearchEpicsSchema = {
  searchTerm: z.string().describe('Epic name or title keyword to search for'),
};

export const GetEpicTasksSchema = {
  epicName: z.string().describe('Exact epic name (matched against Epic field and title pattern [EpicName])'),
};

export const GetEpicTimelineSchema = {
  issueNumber: z.number().int().positive().describe('Epic issue number'),
};

export const ValidateEpicIntegritySchema = {
  issueNumber: z.number().int().positive().describe('Task issue number to check epic integrity for'),
};
