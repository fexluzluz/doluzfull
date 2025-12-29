import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportResults {
  success: number;
  failed: number;
  errors: string[];
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

    if (action === 'import-all') {
      const results = {
        client: { success: false, id: null as string | null, error: null as string | null },
        products: { success: 0, failed: 0, errors: [] as string[] },
        shipments: { success: 0, failed: 0, errors: [] as string[] },
        shipmentItems: { success: 0, failed: 0, errors: [] as string[] },
      };

      // 1. Create Sulvendas client with user
      console.log('Creating Sulvendas client...');
      
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: 'sulvendas@gmail.com',
        password: 'Sulvendas@2024',
        email_confirm: true,
        user_metadata: {
          full_name: 'Sulvendas',
        },
      });

      if (authError) {
        // User might already exist
        console.log('Auth error (user may exist):', authError.message);
        
        // Try to find existing user profile
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, user_id')
          .eq('email', 'sulvendas@gmail.com')
          .maybeSingle();
        
        if (existingProfile) {
          // Check if client already exists
          const { data: existingClient } = await supabase
            .from('clients')
            .select('id')
            .eq('profile_id', existingProfile.id)
            .maybeSingle();
          
          if (existingClient) {
            results.client.success = true;
            results.client.id = existingClient.id;
            console.log('Using existing client:', existingClient.id);
          } else {
            // Create client for existing profile
            const { data: newClient, error: clientError } = await supabase
              .from('clients')
              .insert({
                profile_id: existingProfile.id,
                company_name: 'Sulvendas',
              })
              .select('id')
              .single();
            
            if (clientError) {
              results.client.error = clientError.message;
            } else {
              results.client.success = true;
              results.client.id = newClient.id;
              
              // Add client role
              await supabase.from('user_roles').insert({
                user_id: existingProfile.user_id,
                role: 'client',
              });
            }
          }
        } else {
          results.client.error = authError.message;
        }
      } else if (authData.user) {
        // Wait for trigger to create profile
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', authData.user.id)
          .single();
        
        if (profile) {
          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert({
              profile_id: profile.id,
              company_name: 'Sulvendas',
            })
            .select('id')
            .single();
          
          if (clientError) {
            results.client.error = clientError.message;
          } else {
            results.client.success = true;
            results.client.id = newClient.id;
            
            // Add client role
            await supabase.from('user_roles').insert({
              user_id: authData.user.id,
              role: 'client',
            });
          }
        }
      }

      if (!results.client.id) {
        await mysqlClient.close();
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to create client: ' + results.client.error,
          results 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const clientId = results.client.id;
      console.log('Client ID:', clientId);

      // 2. Import products from estoque
      console.log('Importing products...');
      const estoque = await mysqlClient.query('SELECT * FROM estoque');
      const skuToProductId: Record<string, string> = {};
      
      for (const item of estoque) {
        try {
          const { data: product, error } = await supabase
            .from('products')
            .insert({
              client_id: clientId,
              sku: String(item.sku),
              name: item.descricao || `Produto ${item.sku}`,
              description: item.descricao,
              quantity: item.quantidade_disponivel || 0,
              height_cm: 0,
              width_cm: 0,
              depth_cm: 0,
              weight_kg: 0,
              min_stock_alert: 5,
            })
            .select('id')
            .single();

          if (error) {
            results.products.failed++;
            results.products.errors.push(`SKU ${item.sku}: ${error.message}`);
          } else {
            results.products.success++;
            skuToProductId[String(item.sku)] = product.id;
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          results.products.failed++;
          results.products.errors.push(`SKU ${item.sku}: ${errorMessage}`);
        }
      }

      console.log(`Products imported: ${results.products.success} success, ${results.products.failed} failed`);

      // 3. Import shipments from pedidos
      console.log('Importing shipments...');
      const pedidos = await mysqlClient.query('SELECT * FROM pedidos');
      const pedidoIdToShipmentId: Record<number, string> = {};
      
      // Get admin user for created_by
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', 'sulvendas@gmail.com')
        .single();
      
      const createdBy = adminProfile?.user_id;

      for (const pedido of pedidos) {
        try {
          // Map status
          let status = 'pending';
          if (pedido.enviado === 'Sim') {
            status = 'shipped';
          }

          // Build address
          const addressParts = [
            pedido.enderecoEntrega,
            pedido.numeroEntrega ? `nº ${pedido.numeroEntrega}` : '',
            pedido.complementoEntrega,
            pedido.bairroEntrega,
          ].filter(Boolean);

          const { data: shipment, error } = await supabase
            .from('shipment_requests')
            .insert({
              client_id: clientId,
              status,
              recipient_name: pedido.nomeComprador || 'N/A',
              recipient_phone: pedido.telefoneComprador || null,
              recipient_address: addressParts.join(', ') || pedido.obs || 'Ver observações',
              recipient_city: pedido.cidadeEntrega || 'N/A',
              recipient_state: pedido.estadoEntrega || 'SP',
              recipient_postal_code: pedido.cepEntrega?.trim() || '00000000',
              shipping_label_url: pedido.linketiqueta || null,
              invoice_url: pedido.linkDeclaracao || null,
              tracking_code: pedido.rastreio || null,
              notes: pedido.obs || null,
              created_by: createdBy,
              created_at: pedido.dataCriacao || new Date().toISOString(),
            })
            .select('id')
            .single();

          if (error) {
            results.shipments.failed++;
            results.shipments.errors.push(`Pedido ${pedido.id}: ${error.message}`);
          } else {
            results.shipments.success++;
            pedidoIdToShipmentId[pedido.id] = shipment.id;
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          results.shipments.failed++;
          results.shipments.errors.push(`Pedido ${pedido.id}: ${errorMessage}`);
        }
      }

      console.log(`Shipments imported: ${results.shipments.success} success, ${results.shipments.failed} failed`);

      // 4. Import shipment items from itens_pedido
      console.log('Importing shipment items...');
      const itensPedido = await mysqlClient.query('SELECT * FROM itens_pedido');
      
      for (const item of itensPedido) {
        try {
          const shipmentId = pedidoIdToShipmentId[item.pedido_id];
          const productId = skuToProductId[String(item.sku)];
          
          if (!shipmentId) {
            results.shipmentItems.failed++;
            results.shipmentItems.errors.push(`Item ${item.id}: Shipment not found for pedido_id ${item.pedido_id}`);
            continue;
          }
          
          if (!productId) {
            // Create product on the fly if not found
            const { data: newProduct, error: productError } = await supabase
              .from('products')
              .insert({
                client_id: clientId,
                sku: String(item.sku),
                name: `Produto ${item.sku}`,
                quantity: 0,
                height_cm: 0,
                width_cm: 0,
                depth_cm: 0,
                weight_kg: 0,
                min_stock_alert: 5,
              })
              .select('id')
              .single();
            
            if (productError) {
              results.shipmentItems.failed++;
              results.shipmentItems.errors.push(`Item ${item.id}: Could not create product ${item.sku}`);
              continue;
            }
            
            skuToProductId[String(item.sku)] = newProduct.id;
          }

          const finalProductId = skuToProductId[String(item.sku)];

          const { error } = await supabase
            .from('shipment_items')
            .insert({
              shipment_id: shipmentId,
              product_id: finalProductId,
              quantity: item.quantidade,
            });

          if (error) {
            results.shipmentItems.failed++;
            results.shipmentItems.errors.push(`Item ${item.id}: ${error.message}`);
          } else {
            results.shipmentItems.success++;
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          results.shipmentItems.failed++;
          results.shipmentItems.errors.push(`Item ${item.id}: ${errorMessage}`);
        }
      }

      console.log(`Shipment items imported: ${results.shipmentItems.success} success, ${results.shipmentItems.failed} failed`);

      await mysqlClient.close();
      
      return new Response(JSON.stringify({ 
        success: true, 
        results,
        summary: {
          products: `${results.products.success} importados, ${results.products.failed} falharam`,
          shipments: `${results.shipments.success} importados, ${results.shipments.failed} falharam`,
          shipmentItems: `${results.shipmentItems.success} importados, ${results.shipmentItems.failed} falharam`,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await mysqlClient.close();
    
    return new Response(JSON.stringify({ 
      error: 'Invalid action. Use: import-all' 
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
