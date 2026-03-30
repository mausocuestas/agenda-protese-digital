<script lang="ts">
  import { onMount } from 'svelte'
  import type { EChartsOption } from 'echarts'

  let { option }: { option: EChartsOption } = $props()

  let container: HTMLDivElement
  let chart: import('echarts').ECharts | undefined

  onMount(async () => {
    const ec = await import('echarts')
    chart = ec.init(container, null, { renderer: 'svg' })
    chart.setOption(option)

    const observer = new ResizeObserver(() => chart?.resize())
    observer.observe(container)

    return () => {
      observer.disconnect()
      chart?.dispose()
    }
  })

  $effect(() => {
    // Atualiza o gráfico sempre que a prop option mudar
    if (chart) chart.setOption(option, { notMerge: true })
  })
</script>

<div bind:this={container} class="h-full w-full"></div>
