import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@prossmind/ui/card";
import { Button } from "@prossmind/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@prossmind/ui/table";
import { Badge } from "@prossmind/ui/badge";
import { toast } from "sonner";
import { Shield, Trash2, UserPlus, Crown } from "lucide-react";

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  created_at: string;
  roles: string[];
}

const Admin = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (!session?.user) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return;

      try {
        // Use maybeSingle() to avoid 406 errors when user is not admin
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (error && error.code !== 'PGRST116' && error.code !== 'PGRST301') {
          console.error('Error checking admin status:', error);
          toast.error("Failed to verify admin status");
          navigate("/");
          return;
        }

        const adminStatus = !!data;
        setIsAdmin(adminStatus);
        
        if (!adminStatus) {
          toast.error("Access denied: Admin privileges required");
          navigate("/");
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        navigate("/");
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      checkAdminStatus();
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!isAdmin) return;

      try {
        const { data: profiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (profilesError) throw profilesError;

        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role');

        if (rolesError) throw rolesError;

        const rolesMap = roles?.reduce((acc, role) => {
          if (!acc[role.user_id]) acc[role.user_id] = [];
          acc[role.user_id].push(role.role);
          return acc;
        }, {} as Record<string, string[]>) || {};

        const usersWithRoles = profiles?.map(profile => ({
          ...profile,
          roles: rolesMap[profile.user_id] || ['user']
        })) || [];

        setUsers(usersWithRoles);
      } catch (err) {
        console.error('Error fetching users:', err);
        toast.error("Failed to load users");
      }
    };

    fetchUsers();
  }, [isAdmin]);

  const handleToggleAdmin = async (userId: string, currentRoles: string[]) => {
    const isCurrentlyAdmin = currentRoles.includes('admin');

    try {
      if (isCurrentlyAdmin) {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin');

        if (error) throw error;
        toast.success("Admin privileges revoked");
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'admin' });

        if (error) throw error;
        toast.success("Admin privileges granted");
      }

      // Refresh users list
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const rolesMap = roles?.reduce((acc, role) => {
        if (!acc[role.user_id]) acc[role.user_id] = [];
        acc[role.user_id].push(role.role);
        return acc;
      }, {} as Record<string, string[]>) || {};

      const usersWithRoles = profiles?.map(profile => ({
        ...profile,
        roles: rolesMap[profile.user_id] || ['user']
      })) || [];

      setUsers(usersWithRoles);
    } catch (err) {
      console.error('Error toggling admin:', err);
      toast.error("Failed to update admin status");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }

    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) throw error;

      toast.success("User deleted successfully");
      setUsers(users.filter(u => u.user_id !== userId));
    } catch (err) {
      console.error('Error deleting user:', err);
      toast.error("Failed to delete user");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={user} />
      
      <div className="container mx-auto px-6 py-24">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">Admin Dashboard</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>
              Manage users, assign roles, and control access permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((userProfile) => (
                  <TableRow key={userProfile.id}>
                    <TableCell className="font-medium">{userProfile.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {userProfile.roles.map((role) => (
                          <Badge
                            key={role}
                            variant={role === 'admin' ? 'default' : 'secondary'}
                          >
                            {role === 'admin' && <Crown className="h-3 w-3 mr-1" />}
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(userProfile.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant={userProfile.roles.includes('admin') ? 'destructive' : 'default'}
                          size="sm"
                          onClick={() => handleToggleAdmin(userProfile.user_id, userProfile.roles)}
                          disabled={userProfile.user_id === user?.id}
                        >
                          <Crown className="h-4 w-4 mr-1" />
                          {userProfile.roles.includes('admin') ? 'Revoke Admin' : 'Make Admin'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(userProfile.user_id)}
                          disabled={userProfile.user_id === user?.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
