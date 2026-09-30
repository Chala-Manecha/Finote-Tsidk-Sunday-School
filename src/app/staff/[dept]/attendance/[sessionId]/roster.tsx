'use client';
import { AttendanceRoster, type RosterMember } from '@/components/attendance-roster';
import type { AttendanceStatus } from '@/lib/constants';
import { deleteSession, saveSession } from '../actions';

export function SessionRoster(props: {
  dept: string;
  sessionId: string;
  members: RosterMember[];
  initial: Record<string, AttendanceStatus>;
  canEdit: boolean;
}) {
  return (
    <AttendanceRoster
      members={props.members}
      initial={props.initial}
      startLocked
      saveLabel="ለውጥ አስቀምጥ"
      onSave={(s) => saveSession(props.sessionId, s)}
      onDelete={props.canEdit ? () => deleteSession(props.dept, props.sessionId) : undefined}
    />
  );
}
