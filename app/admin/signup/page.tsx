import { redirect } from 'next/navigation'

export default function AdminSignupPage() {
  // Self-service signup is disabled — this is a single-editor tool. New
  // editor accounts are created directly on the server (see
  // deploy/ec2/finish-setup.sh / scripts/register_admin.py).
  redirect('/admin/login')
}
