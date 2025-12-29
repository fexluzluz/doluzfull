-- Create storage bucket for shipment attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('shipment-attachments', 'shipment-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the bucket
CREATE POLICY "Authenticated users can upload shipment attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'shipment-attachments');

CREATE POLICY "Authenticated users can view shipment attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'shipment-attachments');

CREATE POLICY "Admins can delete shipment attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'shipment-attachments' AND EXISTS (
  SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));