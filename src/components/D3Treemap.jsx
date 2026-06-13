import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';

function D3Treemap({ data, liveDelta }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 600 });
  const svgRef = useRef(null);
  const dataCacheRef = useRef(data); // Mutable reference to the current full tree state
  const tooltipRef = useRef(null);

  // ─── Color Gradient (7-step with neutral zone) ───────────────────────────
  const getFillColor = useCallback((change_pct) => {
    if (change_pct > 3) return '#064e3b';    // deep green
    if (change_pct > 1.5) return '#065f46';  // strong green
    if (change_pct > 0.5) return '#047857';  // green
    if (change_pct > -0.5) return '#18181b'; // neutral (dark zinc)
    if (change_pct > -1.5) return '#991b1b'; // red
    if (change_pct > -3) return '#7f1d1d';   // strong red
    return '#6b0f0f';                         // deep red
  }, []);

  // ─── Dynamic Font Sizing ─────────────────────────────────────────────────
  const getTileWidth = (d) => d.x1 - d.x0;
  const getTileHeight = (d) => d.y1 - d.y0;

  const getSymbolFontSize = (d) => {
    const w = getTileWidth(d);
    const h = getTileHeight(d);
    if (w < 35 || h < 25) return 0; // hide text for tiny tiles
    if (w < 60) return 8;
    if (w < 90) return 10;
    return 12;
  };

  const getChangeFontSize = (d) => {
    const w = getTileWidth(d);
    const h = getTileHeight(d);
    if (w < 50 || h < 35) return 0;
    if (w < 70) return 7;
    if (w < 90) return 9;
    return 11;
  };

  const getPriceFontSize = (d) => {
    const w = getTileWidth(d);
    const h = getTileHeight(d);
    if (w < 80 || h < 50) return 0;
    if (w < 100) return 8;
    return 9;
  };

  // ─── Debounced ResizeObserver ────────────────────────────────────────────
  useEffect(() => {
    const observeTarget = containerRef.current;
    let resizeTimeout = null;

    const observer = new ResizeObserver((entries) => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        for (let entry of entries) {
          setDimensions({
            width: entry.contentRect.width,
            height: Math.max(600, window.innerHeight * 0.7)
          });
        }
      }, 100);
    });

    if (observeTarget) observer.observe(observeTarget);
    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      if (observeTarget) observer.unobserve(observeTarget);
    };
  }, []);

  // ─── Initialize and Render Full Treemap ──────────────────────────────────
  useEffect(() => {
    if (!data || !data.children || dimensions.width === 0) return;

    // Clear previous SVG and tooltip
    d3.select(containerRef.current).selectAll('svg').remove();
    d3.select(containerRef.current).selectAll('.heatmap-tooltip').remove();

    const width = dimensions.width;
    const height = dimensions.height;

    // Create tooltip div
    const tooltipDiv = d3.select(containerRef.current)
      .append('div')
      .attr('class', 'heatmap-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', 'rgba(17, 17, 17, 0.95)')
      .style('border', '1px solid rgba(255,255,255,0.15)')
      .style('border-radius', '8px')
      .style('padding', '8px 12px')
      .style('font-size', '11px')
      .style('color', '#e4e4e7')
      .style('opacity', 0)
      .style('z-index', 100)
      .style('backdrop-filter', 'blur(8px)')
      .style('transition', 'opacity 0.15s ease');

    tooltipRef.current = tooltipDiv;

    const svg = d3.select(containerRef.current)
      .append('svg')
      .attr('viewBox', [0, 0, width, height])
      .attr('width', width)
      .attr('height', height)
      .style('font-family', 'sans-serif')
      .style('background', 'transparent');

    svgRef.current = svg;

    const root = d3.hierarchy(data)
      .sum(d => d.marketCap || 0)
      .sort((a, b) => b.value - a.value);

    d3.treemap()
      .size([width, height])
      .paddingTop(24)
      .paddingRight(1)
      .paddingInner(1)
      .paddingOuter(2)
      .round(true)(root);

    // ─── Render Sector Backgrounds (Groups) ──────────────────────────────
    const sectorNodes = root.children;
    svg.selectAll('g.sector')
      .data(sectorNodes)
      .join('g')
      .attr('class', 'sector')
      .attr('transform', d => `translate(${d.x0},${d.y0})`)
      .append('rect')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', '#18181b')
      .attr('stroke', '#27272a');

    // Sector Labels
    svg.selectAll('text.sector-label')
      .data(sectorNodes)
      .join('text')
      .attr('class', 'sector-label')
      .attr('x', d => d.x0 + 4)
      .attr('y', d => d.y0 + 18)
      .attr('fill', '#a1a1aa')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .text(d => d.data.name);

    // ─── Render Stock Nodes (Leaves) ─────────────────────────────────────
    const leaves = root.leaves();

    const leafNodes = svg.selectAll('g.leaf')
      .data(leaves, d => d.data.symbol)
      .join('g')
      .attr('class', 'leaf')
      .attr('id', d => `leaf-${d.data.symbol}`)
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

    leafNodes.append('rect')
      .attr('class', 'stock-rect')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', d => getFillColor(d.data.change_pct))
      .attr('stroke', 'rgba(0,0,0,0.3)')
      .attr('rx', 4)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('stroke', '#fff').attr('stroke-width', 2).style('filter', 'brightness(1.2)');

        const changeStr = `${d.data.change_pct >= 0 ? '+' : ''}${d.data.change_pct.toFixed(2)}%`;
        const priceStr = d.data.price != null ? `₹${Number(d.data.price).toLocaleString('en-IN')}` : '';
        const fullName = d.data.fullName || d.data.symbol;
        const momentum = d.data.momentum || '';

        tooltipDiv
          .html(`
            <div style="font-weight:700;font-size:12px;margin-bottom:2px;">${d.data.symbol}</div>
            <div style="color:#a1a1aa;font-size:10px;margin-bottom:4px;">${fullName}</div>
            ${priceStr ? `<div style="font-size:11px;margin-bottom:2px;">${priceStr}</div>` : ''}
            <div style="color:${d.data.change_pct >= 0 ? '#34d399' : '#fb7185'};font-weight:600;">${changeStr}</div>
            ${momentum ? `<div style="color:#a1a1aa;font-size:10px;margin-top:2px;">Momentum: ${momentum}</div>` : ''}
          `)
          .style('opacity', 1);
      })
      .on('mousemove', function(event) {
        const containerRect = containerRef.current.getBoundingClientRect();
        tooltipDiv
          .style('left', `${event.clientX - containerRect.left + 12}px`)
          .style('top', `${event.clientY - containerRect.top - 10}px`);
      })
      .on('mouseout', function() {
        d3.select(this).attr('stroke', 'rgba(0,0,0,0.3)').attr('stroke-width', 1).style('filter', 'none');
        tooltipDiv.style('opacity', 0);
      });

    // Stock Symbols (dynamic font size)
    leafNodes.append('text')
      .attr('class', 'stock-symbol')
      .attr('x', 4)
      .attr('y', 16)
      .attr('fill', '#ffffff')
      .attr('font-weight', 'bold')
      .attr('font-size', d => {
        const size = getSymbolFontSize(d);
        return size > 0 ? `${size}px` : '0px';
      })
      .style('opacity', d => getSymbolFontSize(d) > 0 ? 1 : 0)
      .text(d => getSymbolFontSize(d) > 0 ? d.data.symbol : '');

    // Stock Change %
    leafNodes.append('text')
      .attr('class', 'stock-change')
      .attr('x', 4)
      .attr('y', 32)
      .attr('fill', 'rgba(255,255,255,0.7)')
      .attr('font-size', d => {
        const size = getChangeFontSize(d);
        return size > 0 ? `${size}px` : '0px';
      })
      .style('opacity', d => getChangeFontSize(d) > 0 ? 1 : 0)
      .text(d => getChangeFontSize(d) > 0 ? `${d.data.change_pct >= 0 ? '+' : ''}${d.data.change_pct.toFixed(2)}%` : '');

    // Stock Price (for larger tiles)
    leafNodes.append('text')
      .attr('class', 'stock-price')
      .attr('x', 4)
      .attr('y', 46)
      .attr('fill', 'rgba(255,255,255,0.45)')
      .attr('font-size', d => {
        const size = getPriceFontSize(d);
        return size > 0 ? `${size}px` : '0px';
      })
      .style('opacity', d => getPriceFontSize(d) > 0 ? 1 : 0)
      .text(d => {
        if (getPriceFontSize(d) <= 0 || d.data.price == null) return '';
        return `₹${Number(d.data.price).toLocaleString('en-IN')}`;
      });

    // Momentum/Unusual Volume Indicator
    leafNodes.append('circle')
      .attr('class', 'unusual-volume-indicator')
      .attr('cx', d => (d.x1 - d.x0) - 10)
      .attr('cy', 12)
      .attr('r', 4)
      .attr('fill', '#fbbf24')
      .style('opacity', d => d.data.unusualVolume ? 1 : 0);

    dataCacheRef.current = data;

  }, [data, dimensions.width, getFillColor]);

  // ─── Handle Delta WebSocket Updates (Without re-rendering React or D3 layout) ──
  useEffect(() => {
    if (!liveDelta || !svgRef.current) return;

    // Patch changed nodes instantly
    liveDelta.updatedStocks.forEach(stockDelta => {
      const leafGroup = svgRef.current.select(`#leaf-${stockDelta.symbol}`);
      if (!leafGroup.empty()) {
        // Update Color with transition
        leafGroup.select('rect.stock-rect')
          .transition()
          .duration(300)
          .attr('fill', getFillColor(stockDelta.change_pct));

        // Update Change Text
        leafGroup.select('text.stock-change')
          .text(`${stockDelta.change_pct >= 0 ? '+' : ''}${stockDelta.change_pct.toFixed(2)}%`);

        // Update Price Text
        if (stockDelta.price != null) {
          leafGroup.select('text.stock-price')
            .text(`₹${Number(stockDelta.price).toLocaleString('en-IN')}`);
        }

        // Flash if unusual volume detected
        leafGroup.select('circle.unusual-volume-indicator')
          .transition()
          .duration(200)
          .style('opacity', stockDelta.unusualVolume ? 1 : 0);
      }
    });

  }, [liveDelta, getFillColor]);

  // ─── Cleanup tooltip on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (tooltipRef.current) {
        tooltipRef.current.remove();
        tooltipRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative" ref={containerRef}>
      {/* D3 renders SVG and tooltip here */}
    </div>
  );
}

export default React.memo(D3Treemap);
