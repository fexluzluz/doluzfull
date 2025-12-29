import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ManageUserRequest {
  action: "reset_password" | "toggle_active" | "impersonate";
  user_id: string;
  email?: string;
  is_active?: boolean;
  profile_id?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is admin
    const { data: callerRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .maybeSingle();

    if (roleError || callerRole?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores podem gerenciar usuários." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, user_id, email, is_active, profile_id }: ManageUserRequest = await req.json();

    console.log(`Managing user - Action: ${action}, User ID: ${user_id}`);

    if (action === "reset_password") {
      if (!email || !profile_id) {
        return new Response(
          JSON.stringify({ error: "Email e profile_id são obrigatórios para redefinir senha" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate a temporary password
      const tempPassword = Math.random().toString(36).slice(-12) + "A1!";

      // Update user password using admin API
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password: tempPassword,
      });

      if (updateError) {
        console.error("Error updating password:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Set must_change_password to true
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ must_change_password: true })
        .eq("id", profile_id);

      if (profileError) {
        console.error("Error updating profile:", profileError);
      }

      // Send email with Resend
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const siteUrl = Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovableproject.com') || "https://bfeefb08-8367-46cd-ac36-02a7f3b593f9.lovableproject.com";
      
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);

        await resend.emails.send({
          from: "Do Luz Full <noreply@doluz.com.br>",
          to: [email],
          subject: "🔐 Sua Senha Foi Redefinida - Do Luz Full",
          html: `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Do Luz Full</h1>
                    <p style="color: #bfdbfe; margin: 10px 0 0 0; font-size: 14px;">Sistema de Fulfillment</p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px;">🔐 Sua Senha Foi Redefinida</h2>
                    
                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Olá! Um administrador do sistema redefiniu sua senha de acesso.
                    </p>
                    
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                      <p style="color: #92400e; margin: 0 0 10px 0; font-weight: bold; font-size: 14px;">Sua nova senha temporária:</p>
                      <p style="color: #1f2937; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 2px; font-family: monospace;">${tempPassword}</p>
                    </div>
                    
                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                      <strong>⚠️ Importante:</strong> Você será solicitado a criar uma nova senha no próximo login.
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${siteUrl}/auth" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; font-size: 16px; font-weight: bold; border-radius: 8px; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
                        Acessar o Sistema
                      </a>
                    </div>
                    
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                    
                    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
                      Este email foi enviado automaticamente. Se você não solicitou esta alteração, entre em contato com o administrador.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                      © 2024 Do Luz Full - Todos os direitos reservados
                    </p>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        });

        console.log("Password reset email sent to:", email);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Senha redefinida e email enviado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "toggle_active") {
      if (!profile_id || is_active === undefined) {
        return new Response(
          JSON.stringify({ error: "Profile ID e is_active são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update profile is_active status
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ is_active })
        .eq("id", profile_id);

      if (updateError) {
        console.error("Error updating profile:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If deactivating, also ban the user in auth
      if (!is_active) {
        const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
          ban_duration: "876000h", // ~100 years
        });

        if (banError) {
          console.error("Error banning user:", banError);
        }
      } else {
        // If activating, unban the user
        const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
          ban_duration: "none",
        });

        if (unbanError) {
          console.error("Error unbanning user:", unbanError);
        }
      }

      console.log(`User ${user_id} is now ${is_active ? "active" : "inactive"}`);

      return new Response(
        JSON.stringify({ success: true, message: is_active ? "Usuário ativado" : "Usuário desativado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "impersonate") {
      if (!user_id || !email) {
        return new Response(
          JSON.stringify({ error: "User ID e email são obrigatórios para impersonar" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate a magic link for the target user
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: email,
      });

      if (linkError) {
        console.error("Error generating magic link:", linkError);
        return new Response(
          JSON.stringify({ error: linkError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Admin impersonating user ${user_id}, token hash generated`);

      // Return the token hash for the frontend to use with verifyOtp
      return new Response(
        JSON.stringify({ 
          success: true, 
          email: email,
          token_hash: linkData.properties?.hashed_token,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in manage-user function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
