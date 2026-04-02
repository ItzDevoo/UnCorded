import { createDockerClient } from "./docker-host";

export class NetworkManager {
  private docker: ReturnType<typeof createDockerClient>;

  constructor() {
    this.docker = createDockerClient();
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

    // Not Internal — plugins need to reach the host bridge server via
    // host.docker.internal. External internet access is restricted by
    // container CapDrop ALL + no outbound port mappings.
    const network = await this.docker.createNetwork({
      Name: name,
      Driver: "bridge",
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
        // eslint-disable-next-line no-await-in-loop
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
      throw new Error(`Plugin network '${name}' not found`);
    }

    const network = this.docker.getNetwork(networks[0]!.Id);
    await network.connect({ Container: containerId });
  }
}
