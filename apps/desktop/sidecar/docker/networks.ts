import Dockerode from "dockerode";

export class NetworkManager {
  private docker: Dockerode;

  constructor() {
    this.docker = new Dockerode();
  }

  async createPluginNetwork(pluginId: string): Promise<string> {
    const name = `uncorded-plugin-${pluginId}`;

    // Check if it already exists
    const networks = await this.docker.listNetworks({
      filters: { name: [name] },
    });

    if (networks.length > 0) {
      return networks[0]!.Id;
    }

    const network = await this.docker.createNetwork({
      Name: name,
      Driver: "bridge",
      Internal: true, // No external internet access by default
      Labels: {
        "uncorded.plugin.id": pluginId,
        "uncorded.managed": "true",
      },
    });

    return network.id;
  }

  async removePluginNetwork(pluginId: string): Promise<void> {
    const name = `uncorded-plugin-${pluginId}`;
    const networks = await this.docker.listNetworks({
      filters: { name: [name] },
    });

    for (const net of networks) {
      const network = this.docker.getNetwork(net.Id);
      try {
        await network.remove();
      } catch (err) {
        console.error(`[networks] Failed to remove network ${name}:`, err);
      }
    }
  }

  async connectContainer(pluginId: string, containerId: string): Promise<void> {
    const name = `uncorded-plugin-${pluginId}`;
    const networks = await this.docker.listNetworks({
      filters: { name: [name] },
    });

    if (networks.length === 0) {
      throw new Error(`Network ${name} not found`);
    }

    const network = this.docker.getNetwork(networks[0]!.Id);
    await network.connect({ Container: containerId });
  }
}
