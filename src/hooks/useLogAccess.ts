import { useAuth } from "./useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useLogAccess = () => {
  const { user, profile } = useAuth();
  
  // Verifica se é o owner dos logs (Felipe)
  const isLogOwner = profile?.email?.toLowerCase() === 'felipe.luz@doluz.com.br';
  
  // Verifica se tem acesso aos logs
  const { data: hasLogAccess, isLoading } = useQuery({
    queryKey: ['log-access', user?.id],
    queryFn: async () => {
      if (!user) return false;
      if (isLogOwner) return true;
      
      const { data, error } = await supabase
        .from('log_access_permissions')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error checking log access:', error);
        return false;
      }
      
      return !!data;
    },
    enabled: !!user,
  });

  return {
    isLogOwner,
    hasLogAccess: hasLogAccess ?? false,
    isLoading,
  };
};
