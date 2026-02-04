import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductRow {
  sku: string;
  name: string;
  description: string | null;
  quantity: number;
  weight_kg: number;
  width_cm: number;
  height_cm: number;
  depth_cm: number;
  min_stock_alert: number;
  max_stock_alert: number | null;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ';' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

function parseNumber(value: string): number {
  if (!value || value.trim() === '') return 0;
  // Replace comma with dot for decimal numbers
  const cleaned = value.replace(',', '.').replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvContent, clientId } = await req.json();
    
    if (!csvContent || !clientId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'CSV content and client ID are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Connect to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, company_name')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Client not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Importing products for client: ${client.company_name}`);

    // Parse CSV - handle BOM and split into lines properly
    let content = csvContent;
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.substring(1);
    }
    
    // Split by newlines but handle multi-line descriptions
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        currentLine += char;
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (currentLine.trim()) {
          lines.push(currentLine);
        }
        currentLine = '';
        // Skip \r\n combo
        if (char === '\r' && content[i + 1] === '\n') {
          i++;
        }
      } else {
        currentLine += char;
      }
    }
    if (currentLine.trim()) {
      lines.push(currentLine);
    }

    if (lines.length < 2) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'CSV must have header and at least one data row' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse header to find column indices
    const header = parseCSVLine(lines[0]);
    console.log('CSV columns:', header.slice(0, 10));

    // Map columns (adjust based on actual CSV structure)
    const colIndices = {
      codigo: header.findIndex(h => h.toLowerCase().includes('código') || h.toLowerCase() === 'codigo'),
      descricao: header.findIndex(h => h.toLowerCase().includes('descrição') || h.toLowerCase() === 'descricao'),
      estoque: header.findIndex(h => h.toLowerCase() === 'estoque'),
      pesoLiquido: header.findIndex(h => h.toLowerCase().includes('peso líquido') || h.toLowerCase().includes('peso liquido')),
      pesoBruto: header.findIndex(h => h.toLowerCase().includes('peso bruto')),
      largura: header.findIndex(h => h.toLowerCase().includes('largura')),
      altura: header.findIndex(h => h.toLowerCase().includes('altura')),
      profundidade: header.findIndex(h => h.toLowerCase().includes('profundidade')),
      estoqueMin: header.findIndex(h => h.toLowerCase().includes('estoque mínimo') || h.toLowerCase().includes('estoque minimo')),
      estoqueMax: header.findIndex(h => h.toLowerCase().includes('estoque máximo') || h.toLowerCase().includes('estoque maximo')),
      situacao: header.findIndex(h => h.toLowerCase() === 'situação' || h.toLowerCase() === 'situacao'),
    };

    console.log('Column indices:', colIndices);

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Get existing products to check for duplicates
    const { data: existingProducts } = await supabase
      .from('products')
      .select('sku')
      .eq('client_id', clientId);

    const existingSkus = new Set(existingProducts?.map(p => p.sku.trim()) || []);

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      try {
        const row = parseCSVLine(lines[i]);
        
        if (row.length < 3) {
          console.log(`Skipping row ${i}: too few columns`);
          continue;
        }

        // Get SKU/Codigo
        let sku = colIndices.codigo >= 0 ? row[colIndices.codigo] : row[1];
        sku = sku?.trim() || '';
        
        if (!sku) {
          console.log(`Skipping row ${i}: no SKU`);
          results.skipped++;
          continue;
        }

        // Check situação - skip if not "Ativo"
        if (colIndices.situacao >= 0) {
          const situacao = row[colIndices.situacao]?.trim().toLowerCase();
          if (situacao && situacao !== 'ativo') {
            console.log(`Skipping row ${i}: situacao = ${situacao}`);
            results.skipped++;
            continue;
          }
        }

        // Check if SKU already exists
        if (existingSkus.has(sku)) {
          console.log(`Skipping row ${i}: SKU ${sku} already exists`);
          results.skipped++;
          continue;
        }

        // Get description/name
        let name = colIndices.descricao >= 0 ? row[colIndices.descricao] : row[2];
        name = name?.trim() || `Produto ${sku}`;
        
        // Clean up name - remove HTML tags
        name = name.replace(/<[^>]*>/g, '').trim();
        if (name.length > 200) {
          name = name.substring(0, 197) + '...';
        }

        // Get numeric values
        const quantity = Math.max(0, Math.floor(parseNumber(colIndices.estoque >= 0 ? row[colIndices.estoque] : '0')));
        const weight = parseNumber(colIndices.pesoLiquido >= 0 ? row[colIndices.pesoLiquido] : (colIndices.pesoBruto >= 0 ? row[colIndices.pesoBruto] : '0'));
        const width = parseNumber(colIndices.largura >= 0 ? row[colIndices.largura] : '0');
        const height = parseNumber(colIndices.altura >= 0 ? row[colIndices.altura] : '0');
        const depth = parseNumber(colIndices.profundidade >= 0 ? row[colIndices.profundidade] : '0');
        const minStock = Math.max(0, Math.floor(parseNumber(colIndices.estoqueMin >= 0 ? row[colIndices.estoqueMin] : '5')));
        const maxStock = colIndices.estoqueMax >= 0 ? Math.floor(parseNumber(row[colIndices.estoqueMax])) : null;

        const product = {
          client_id: clientId,
          sku,
          name,
          description: null,
          quantity,
          weight_kg: weight,
          width_cm: width,
          height_cm: height,
          depth_cm: depth,
          min_stock_alert: minStock || 5,
          max_stock_alert: maxStock && maxStock > 0 ? maxStock : null,
        };

        console.log(`Inserting product ${i}: SKU=${sku}, name=${name.substring(0, 30)}...`);

        const { error } = await supabase.from('products').insert(product);

        if (error) {
          results.failed++;
          results.errors.push(`SKU ${sku}: ${error.message}`);
          console.error(`Error inserting SKU ${sku}:`, error.message);
        } else {
          results.success++;
          existingSkus.add(sku);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        results.failed++;
        results.errors.push(`Row ${i}: ${errorMessage}`);
        console.error(`Error processing row ${i}:`, errorMessage);
      }
    }

    console.log(`Import complete: ${results.success} success, ${results.failed} failed, ${results.skipped} skipped`);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      summary: {
        total: lines.length - 1,
        imported: results.success,
        failed: results.failed,
        skipped: results.skipped,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error:', errorMessage);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
