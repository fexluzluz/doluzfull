import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface CnpjResult {
  company_name: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  phone?: string;
}

export function useCnpjLookup() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const lookupCnpj = async (cnpj: string): Promise<CnpjResult | null> => {
    // Remove non-numeric characters
    const cleanCnpj = cnpj.replace(/\D/g, '');
    
    if (cleanCnpj.length !== 14) {
      toast({
        variant: 'destructive',
        title: 'CNPJ inválido',
        description: 'O CNPJ deve ter 14 dígitos.',
      });
      return null;
    }

    setIsLoading(true);

    try {
      // Using BrasilAPI for CNPJ lookup (free, no auth required)
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            variant: 'destructive',
            title: 'CNPJ não encontrado',
            description: 'Verifique o CNPJ informado.',
          });
        } else {
          throw new Error('Erro na consulta');
        }
        return null;
      }

      const data = await response.json();

      // Format postal code
      const postalCode = data.cep ? data.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2') : '';

      // Build address
      const addressParts = [data.logradouro, data.numero, data.complemento, data.bairro]
        .filter(Boolean)
        .join(', ');

      return {
        company_name: data.razao_social || data.nome_fantasia || '',
        address: addressParts,
        city: data.municipio || '',
        state: data.uf || '',
        postal_code: postalCode,
        phone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}` : undefined,
      };
    } catch (error) {
      console.error('Error looking up CNPJ:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao consultar CNPJ',
        description: 'Não foi possível consultar os dados do CNPJ. Tente novamente.',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { lookupCnpj, isLoading };
}
