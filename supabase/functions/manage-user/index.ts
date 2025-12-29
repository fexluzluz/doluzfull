import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ManageUserRequest {
  action: "reset_password" | "toggle_active";
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
      if (!email) {
        return new Response(
          JSON.stringify({ error: "Email é obrigatório para redefinir senha" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate a password reset link
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: email,
      });

      if (error) {
        console.error("Error generating reset link:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send email with Resend
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);

        const resetLink = data.properties?.action_link;

        await resend.emails.send({
          from: "Do Luz Full <noreply@doluz.com.br>",
          to: [email],
          subject: "Redefinição de Senha - Do Luz Full",
          html: `
            <h1>Redefinição de Senha</h1>
            <p>Você recebeu este email porque um administrador solicitou a redefinição da sua senha.</p>
            <p>Clique no link abaixo para criar uma nova senha:</p>
            <p><a href="${resetLink}">Redefinir minha senha</a></p>
            <p>Se você não solicitou esta redefinição, ignore este email.</p>
            <p>Atenciosamente,<br>Equipe Do Luz Full</p>
          `,
        });

        console.log("Password reset email sent to:", email);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Email de redefinição enviado" }),
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
