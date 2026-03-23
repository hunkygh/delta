import { supabase } from './supabaseClient.js';
import { cloneNodeStructureConfig, createDefaultNodeStructureConfig, shellNodeCatalog, type ShellInstalledNode, type ShellNodeDefinition, type ShellNodeStructureConfig } from '../components/shell/nodeRuntime';

interface PublishedNodeRow {
  id: string;
  slug: string;
  name: string;
  summary: string;
  version: string;
  category: string;
  setup_summary: string;
  setup_prompt: string;
  structure_blueprint: string | null;
  structure_config: ShellNodeStructureConfig | null;
  setup_logic: string | null;
  operate_logic: string | null;
  owner_user_id: string | null;
  icon_key: 'compass' | 'app' | 'computer_dollar' | null;
  version_notes: string | null;
}

interface InstalledNodeRow {
  id: string;
  node_id: string;
  installed_at: string;
  setup_completed: boolean;
  installed_node_focals?: Array<{ focal_id: string }>;
}

const mapPublishedNode = (row: PublishedNodeRow): ShellNodeDefinition => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  summary: row.summary,
  version: row.version,
  category: row.category,
  setupSummary: row.setup_summary,
  setupPrompt: row.setup_prompt,
  structureBlueprint: row.structure_blueprint || '',
  structureConfig: cloneNodeStructureConfig(row.structure_config || createDefaultNodeStructureConfig()),
  setupLogic: row.setup_logic || row.setup_prompt,
  operateLogic: row.operate_logic || '',
  ownerUserId: row.owner_user_id,
  iconKey: row.icon_key || 'app',
  versionNotes: row.version_notes || undefined
});

const mapInstalledNode = (row: InstalledNodeRow): ShellInstalledNode => ({
  id: row.id,
  nodeId: row.node_id,
  installedAt: row.installed_at,
  assignedFocalIds: Array.isArray(row.installed_node_focals)
    ? row.installed_node_focals.map((entry) => entry.focal_id).filter(Boolean)
    : [],
  setupCompleted: Boolean(row.setup_completed)
});

const requireCurrentUserId = async (): Promise<string> => {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    throw error || new Error('Not authenticated');
  }

  return user.id;
};

const nodeMarketplaceService = {
  async listPublishedNodes(): Promise<ShellNodeDefinition[]> {
    const { data, error } = await supabase
      .from('published_nodes')
      .select('id,slug,name,summary,version,category,setup_summary,setup_prompt,structure_blueprint,structure_config,setup_logic,operate_logic,owner_user_id,icon_key,version_notes')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error || !Array.isArray(data) || data.length === 0) {
      return shellNodeCatalog;
    }

    return data.map((row) => mapPublishedNode(row as PublishedNodeRow));
  },

  async listInstalledNodes(): Promise<ShellInstalledNode[]> {
    const { data, error } = await supabase
      .from('installed_nodes')
      .select('id,node_id,installed_at,setup_completed,installed_node_focals(focal_id)')
      .order('installed_at', { ascending: true });

    if (error || !Array.isArray(data)) {
      return [];
    }

    return data.map((row) => mapInstalledNode(row as InstalledNodeRow));
  },

  async installNode(nodeId: string, defaultFocalId?: string | null): Promise<ShellInstalledNode[]> {
    const userId = await requireCurrentUserId();
    const { data: installedRow, error: installError } = await supabase
      .from('installed_nodes')
      .upsert(
        {
          user_id: userId,
          node_id: nodeId,
          setup_completed: false
        },
        {
          onConflict: 'user_id,node_id'
        }
      )
      .select('id')
      .single();

    if (installError) {
      throw installError;
    }

    if (defaultFocalId && installedRow?.id) {
      await supabase
        .from('installed_node_focals')
        .upsert(
          {
            installed_node_id: installedRow.id,
            focal_id: defaultFocalId
          },
          {
            onConflict: 'installed_node_id,focal_id'
          }
        );
    }

    return this.listInstalledNodes();
  },

  async uninstallNode(nodeId: string): Promise<ShellInstalledNode[]> {
    const userId = await requireCurrentUserId();
    const { error } = await supabase.from('installed_nodes').delete().eq('node_id', nodeId).eq('user_id', userId);
    if (error) {
      throw error;
    }
    return this.listInstalledNodes();
  },

  async toggleNodeFocalAssignment(nodeId: string, focalId: string): Promise<ShellInstalledNode[]> {
    const userId = await requireCurrentUserId();
    const { data: installedNode, error: installedError } = await supabase
      .from('installed_nodes')
      .select('id')
      .eq('node_id', nodeId)
      .eq('user_id', userId)
      .single();

    if (installedError || !installedNode?.id) {
      throw installedError || new Error('Installed node not found');
    }

    const { data: existing } = await supabase
      .from('installed_node_focals')
      .select('installed_node_id')
      .eq('installed_node_id', installedNode.id)
      .eq('focal_id', focalId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('installed_node_focals')
        .delete()
        .eq('installed_node_id', installedNode.id)
        .eq('focal_id', focalId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('installed_node_focals')
        .insert({
          installed_node_id: installedNode.id,
          focal_id: focalId
        });
      if (error) throw error;
    }

    return this.listInstalledNodes();
  },

  async markSetupCompleted(nodeId: string): Promise<ShellInstalledNode[]> {
    const userId = await requireCurrentUserId();
    const { error } = await supabase
      .from('installed_nodes')
      .update({ setup_completed: true })
      .eq('node_id', nodeId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return this.listInstalledNodes();
  },

  async updatePublishedNode(
    nodeId: string,
    updates: Partial<Pick<ShellNodeDefinition, 'name' | 'summary' | 'category' | 'setupSummary' | 'setupPrompt' | 'structureBlueprint' | 'structureConfig' | 'setupLogic' | 'operateLogic' | 'iconKey' | 'versionNotes'>>
  ): Promise<ShellNodeDefinition[]> {
    const userId = await requireCurrentUserId();
    const payload: Record<string, unknown> = {
      owner_user_id: userId
    };

    if (typeof updates.name === 'string') payload.name = updates.name;
    if (typeof updates.summary === 'string') payload.summary = updates.summary;
    if (typeof updates.category === 'string') payload.category = updates.category;
    if (typeof updates.setupSummary === 'string') payload.setup_summary = updates.setupSummary;
    if (typeof updates.setupPrompt === 'string') payload.setup_prompt = updates.setupPrompt;
    if (typeof updates.structureBlueprint === 'string') payload.structure_blueprint = updates.structureBlueprint;
    if (updates.structureConfig) payload.structure_config = updates.structureConfig;
    if (typeof updates.setupLogic === 'string') payload.setup_logic = updates.setupLogic;
    if (typeof updates.operateLogic === 'string') payload.operate_logic = updates.operateLogic;
    if (typeof updates.iconKey === 'string') payload.icon_key = updates.iconKey;
    if (typeof updates.versionNotes === 'string') payload.version_notes = updates.versionNotes;

    const { error } = await supabase
      .from('published_nodes')
      .update(payload)
      .eq('id', nodeId);

    if (error) {
      throw error;
    }

    return this.listPublishedNodes();
  }
};

export default nodeMarketplaceService;
