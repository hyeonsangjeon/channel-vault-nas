import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import type { ChannelLink, ChannelNode } from "../data/observatory";

type SimNode = ChannelNode & d3.SimulationNodeDatum & { radius: number };
type SimLink = d3.SimulationLinkDatum<SimNode> & { weight: number };

function channelColor(channel: ChannelNode) {
  if (channel.failedJobs > 0 || channel.health < 84) return "var(--color-danger)";
  if (channel.health < 90 || channel.storageGb > 360) return "var(--color-warning)";
  if (channel.newVideos > 2) return "var(--color-info)";
  return "var(--color-success)";
}

export function ChannelConstellation({
  channels,
  links,
}: {
  channels: ChannelNode[];
  links: ChannelLink[];
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const graph = useMemo(() => {
    const nodes: SimNode[] = channels.map((channel) => ({
      ...channel,
      radius: 18 + Math.sqrt(channel.storageGb) * 1.15,
    }));
    const linkData: SimLink[] = links.map((link) => ({ ...link }));
    return { nodes, linkData };
  }, [channels, links]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 760;
    const height = 430;

    const root = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "Channel health constellation");

    root
      .append("defs")
      .append("filter")
      .attr("id", "soft-glow")
      .append("feGaussianBlur")
      .attr("stdDeviation", "3")
      .attr("result", "coloredBlur");

    const simulation = d3
      .forceSimulation<SimNode>(graph.nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(graph.linkData)
          .id((node) => node.id)
          .distance((link) => 86 - link.weight * 8)
          .strength(0.28),
      )
      .force("charge", d3.forceManyBody().strength(-260))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<SimNode>().radius((node) => node.radius + 12));

    const link = root
      .append("g")
      .attr("class", "constellation-links")
      .selectAll("line")
      .data(graph.linkData)
      .join("line")
      .attr("stroke-width", (d) => 0.7 + d.weight * 0.35);

    const node = root
      .append("g")
      .attr("class", "constellation-nodes")
      .selectAll<SVGGElement, SimNode>("g")
      .data(graph.nodes)
      .join("g")
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.25).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    node
      .append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => channelColor(d))
      .attr("fill-opacity", 0.16)
      .attr("stroke", (d) => channelColor(d))
      .attr("stroke-width", 1.5);

    node
      .append("circle")
      .attr("r", (d) => Math.max(5, d.radius * 0.28))
      .attr("fill", (d) => channelColor(d));

    node
      .append("text")
      .attr("y", (d) => d.radius + 17)
      .attr("text-anchor", "middle")
      .text((d) => d.title);

    node
      .append("text")
      .attr("y", 4)
      .attr("text-anchor", "middle")
      .attr("class", "health-label")
      .text((d) => d.health);

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graph]);

  return (
    <div className="constellation-shell">
      <svg ref={svgRef} />
    </div>
  );
}
