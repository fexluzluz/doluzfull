import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Json } from "@/integrations/supabase/types";

interface LogEntry {
  action_type: string;
  entity_type: string;
  entity_id?: string;
  description: string;
  details?: Json;
  client_id?: string;
}

export const useSystemLog = () => {
  const { user, profile } = useAuth();

  const logAction = async (entry: LogEntry) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('system_logs')
        .insert([{
          action_type: entry.action_type,
          entity_type: entry.entity_type,
          entity_id: entry.entity_id,
          description: entry.description,
          details: entry.details,
          performed_by: user.id,
          performed_by_name: profile?.full_name || user.email,
          client_id: entry.client_id,
        }]);

      if (error) {
        console.error('Error logging action:', error);
      }
    } catch (err) {
      console.error('Error in logAction:', err);
    }
  };

  return { logAction };
};
