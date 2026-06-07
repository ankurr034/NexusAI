import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';

export default function D3Treemap({ data, liveDelta }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 600 });
  const svgRef = useRef(null);
  const dataCacheRef = useRef(data); // Mutable reference to the current full tree state

  // Update layout on window resize
  useEffect(() => {
    const observeTarget = containerRef.current;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
         setDimensions({
           width: entry.contentRect.width,
           height: Math.max(600, window.innerHeight * 0.7) // Dynamic height based on viewport
         });
      }
    });
    if (observeTarget) observer.observe(observeTarget);
    return () => { if (observeTarget) observer.unobserve(observeTarget); };
  }, []);

  // Initialize and Render Full Treemap
  useEffect(() => {
    if (!data || !data.children || dimensions.width === 0) return;
    
    // Clear previous SVG
    d3.select(containerRef.current).selectAll("svg").remove();

    const width = dimensions.width;
    const height = dimensions.height;

    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr("viewBox", [0, 0, width, height])
      .attr("width", width)
      .attr("height", height)
      .style("font-family", "sans-serif")
      .style("background", "transparent");

    svgRef.current = svg;

    const root = d3.hierarchy(data)
      .sum(d => d.marketCap || 0)
      .sort((a, b) => b.value - a.value);

    d3.treemap()
      .size([width, height])
      .paddingTop(28)
      .paddingRight(2)
      .paddingInner(2)
      .round(true)(root);

    const getFillColor = (change_pct) => {
        if (change_pct > 3) return '#064e3b';
        if (change_pct > 1.5) return '#065f46';
        if (change_pct > 0) return '#047857';
        if (change_pct > -1.5) return '#b91c1c';
        if (change_pct > -3) return '#991b1b';
        return '#7f1d1d';
    };

    // Render Sector Backgrounds (Groups)
    const sectorNodes = root.children;
    svg.selectAll("g.sector")
      .data(sectorNodes)
      .join("g")
      .attr("class", "sector")
      .attr("transform", d => `translate(${d.x0},${d.y0})`)
      .append("rect")
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0)
      .attr("fill", "#18181b")
      .attr("stroke", "#27272a");

    // Sector Labels
    svg.selectAll("text.sector-label")
      .data(sectorNodes)
      .join("text")
      .attr("class", "sector-label")
      .attr("x", d => d.x0 + 4)
      .attr("y", d => d.y0 + 18)
      .attr("fill", "#a1a1aa")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .text(d => d.data.name);

    // Render Stock Nodes (Leaves)
    const leaves = root.leaves();

    const leafNodes = svg.selectAll("g.leaf")
      .data(leaves, d => d.data.symbol) // Key by symbol for delta updates
      .join("g")
      .attr("class", "leaf")
      .attr("id", d => `leaf-${d.data.symbol}`)
      .attr("transform", d => `translate(${d.x0},${d.y0})`);

    leafNodes.append("rect")
      .attr("class", "stock-rect")
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0)
      .attr("fill", d => getFillColor(d.data.change_pct))
      .attr("stroke", "rgba(0,0,0,0.3)")
      .attr("rx", 4)
      .style("cursor", "pointer")
      // Hover Analytics (Tooltip logic could be added here via D3, but we'll keep it simple for now)
      .on("mouseover", function() {
         d3.select(this).attr("stroke", "#fff").attr("stroke-width", 2).style("filter", "brightness(1.2)");
      })
      .on("mouseout", function() {
         d3.select(this).attr("stroke", "rgba(0,0,0,0.3)").attr("stroke-width", 1).style("filter", "none");
      });

    // Stock Symbols
    leafNodes.append("text")
      .attr("class", "stock-symbol")
      .attr("x", 4)
      .attr("y", 16)
      .attr("fill", "#ffffff")
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .text(d => (d.x1 - d.x0) > 40 ? d.data.symbol : "");

    // Stock Change %
    leafNodes.append("text")
      .attr("class", "stock-change")
      .attr("x", 4)
      .attr("y", 32)
      .attr("fill", "rgba(255,255,255,0.7)")
      .attr("font-size", "11px")
      .text(d => (d.x1 - d.x0) > 40 ? `${d.data.change_pct >= 0 ? '+' : ''}${d.data.change_pct.toFixed(2)}%` : "");
      
    // Momentum/Unusual Volume Indicator
    leafNodes.append("circle")
      .attr("class", "unusual-volume-indicator")
      .attr("cx", d => (d.x1 - d.x0) - 10)
      .attr("cy", 12)
      .attr("r", 4)
      .attr("fill", "#fbbf24")
      .style("opacity", d => d.data.unusualVolume ? 1 : 0);

  }, [data, dimensions.width]);

  // Handle Delta WebSocket Updates efficiently (Without re-rendering React or D3 layout)
  useEffect(() => {
    if (!liveDelta || !svgRef.current) return;

    const getFillColor = (change_pct) => {
        if (change_pct > 3) return '#064e3b';
        if (change_pct > 1.5) return '#065f46';
        if (change_pct > 0) return '#047857';
        if (change_pct > -1.5) return '#b91c1c';
        if (change_pct > -3) return '#991b1b';
        return '#7f1d1d';
    };

    // Patch changed nodes instantly
    liveDelta.updatedStocks.forEach(stockDelta => {
        const leafGroup = svgRef.current.select(`#leaf-${stockDelta.symbol}`);
        if (!leafGroup.empty()) {
            // Update Color
            leafGroup.select("rect.stock-rect")
               .transition()
               .duration(300)
               .attr("fill", getFillColor(stockDelta.change_pct));

            // Update Text
            leafGroup.select("text.stock-change")
               .text(`${stockDelta.change_pct >= 0 ? '+' : ''}${stockDelta.change_pct.toFixed(2)}%`);

            // Flash if unusual volume detected
            leafGroup.select("circle.unusual-volume-indicator")
               .transition()
               .duration(200)
               .style("opacity", stockDelta.unusualVolume ? 1 : 0);
        }
    });

  }, [liveDelta]);

  return (
    <div className="w-full h-full relative" ref={containerRef}>
      {/* Tooltip anchor can be added here if needed */}
    </div>
  );
}
