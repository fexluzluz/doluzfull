import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TableStructure {
  columns: unknown[];
  sampleData: unknown[];
  totalRows: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();
    
    // Connect to MySQL
    const mysqlClient = await new Client().connect({
      hostname: Deno.env.get('MYSQL_HOST')!,
      username: Deno.env.get('MYSQL_USER')!,
      db: Deno.env.get('MYSQL_DATABASE')!,
      password: Deno.env.get('MYSQL_PASSWORD')!,
      port: 3306,
    });

    console.log('Connected to MySQL successfully');

    // Connect to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'get-structure') {
      // Get all tables
      const tables = await mysqlClient.query('SHOW TABLES');
      const tableNames = tables.map((row: Record<string, string>) => Object.values(row)[0]);
      
      const structure: Record<string, TableStructure> = {};
      
      for (const tableName of tableNames) {
        const columns = await mysqlClient.query(`DESCRIBE ${tableName}`);
        const sampleData = await mysqlClient.query(`SELECT * FROM ${tableName} LIMIT 5`);
        const countResult = await mysqlClient.query(`SELECT COUNT(*) as total FROM ${tableName}`);
        
        structure[tableName as string] = {
          columns,
          sampleData,
          totalRows: countResult[0]?.total || 0,
        };
      }
      
      await mysqlClient.close();
      
      return new Response(JSON.stringify({ 
        success: true, 
        tables: tableNames,
        structure 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'import-clients') {
      // Example: Import clients from a typical table structure
      // Adjust based on actual MySQL table structure
      const clients = await mysqlClient.query('SELECT * FROM clientes');
      
      console.log(`Found ${clients.length} clients to import`);
      
      const importResults = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const client of clients) {
        try {
          // Create user in auth
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: client.email || `${client.id}@imported.local`,
            password: Math.random().toString(36).slice(-12),
            email_confirm: true,
            user_metadata: {
              full_name: client.nome || client.razao_social,
              imported: true,
            },
          });

          if (authError) {
            importResults.failed++;
            importResults.errors.push(`Client ${client.id}: ${authError.message}`);
            continue;
          }

          // Get the profile created by trigger
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', authData.user.id)
            .single();

          if (profile) {
            // Create client record
            await supabase.from('clients').insert({
              profile_id: profile.id,
              company_name: client.razao_social || client.nome,
              cnpj: client.cnpj,
              address: client.endereco,
              city: client.cidade,
              state: client.estado || client.uf,
              postal_code: client.cep,
            });

            // Add client role
            await supabase.from('user_roles').insert({
              user_id: authData.user.id,
              role: 'client',
            });

            importResults.success++;
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          importResults.failed++;
          importResults.errors.push(`Client ${client.id}: ${errorMessage}`);
        }
      }

      await mysqlClient.close();
      
      return new Response(JSON.stringify({ 
        success: true, 
        results: importResults 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'import-products') {
      const products = await mysqlClient.query('SELECT * FROM produtos');
      
      console.log(`Found ${products.length} products to import`);
      
      const importResults = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const product of products) {
        try {
          // Map old client_id to new client_id (you'll need to maintain a mapping)
          const { error } = await supabase.from('products').insert({
            sku: product.sku || product.codigo,
            name: product.nome || product.descricao,
            description: product.descricao,
            height_cm: product.altura || 0,
            width_cm: product.largura || 0,
            depth_cm: product.profundidade || product.comprimento || 0,
            weight_kg: product.peso || 0,
            quantity: product.quantidade || product.estoque || 0,
            min_stock_alert: product.estoque_minimo || 5,
            // client_id needs to be mapped from old to new
          });

          if (error) {
            importResults.failed++;
            importResults.errors.push(`Product ${product.id}: ${error.message}`);
          } else {
            importResults.success++;
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          importResults.failed++;
          importResults.errors.push(`Product ${product.id}: ${errorMessage}`);
        }
      }

      await mysqlClient.close();
      
      return new Response(JSON.stringify({ 
        success: true, 
        results: importResults 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await mysqlClient.close();
    
    return new Response(JSON.stringify({ 
      error: 'Invalid action. Use: get-structure, import-clients, import-products' 
    }), {
      status: 400,
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
