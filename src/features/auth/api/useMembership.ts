import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toMembership } from '../domain/membership'

export function useMembership(userId: string) {
  return useQuery({
    queryKey: ['membership', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id, display_name, status, role')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return toMembership(data)
    },
  })
}
