import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface CepData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface CepResult {
  address: string;
  city: string;
  state: string;
}

export function useCepLookup() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const lookupCep = async (cep: string): Promise<CepResult | null> => {
    // Remove non-numeric characters
    const cleanCep = cep.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) {
      return null;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data: CepData = await response.json();

      if (data.erro) {
        toast({
          variant: 'destructive',
          title: 'CEP não encontrado',
          description: 'Verifique o CEP informado.',
        });
        return null;
      }

      return {
        address: data.logradouro || '',
        city: data.localidade || '',
        state: data.uf || '',
      };
    } catch (error) {
      console.error('Error looking up CEP:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar CEP',
        description: 'Não foi possível consultar o CEP.',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { lookupCep, isLoading };
}
