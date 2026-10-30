import { rm } from 'node:fs/promises'

// Once launch begins, a rejected start does not establish that the supervisor
// cleaned up. Keep the adapter and control data until cleanup is confirmed.
export async function launchSidebar(world, start) {
  world.sidebarCleanupUnconfirmed = true
  try {
    world.sidebarPty = await start()
  } catch (error) {
    error.message += `; adapter and control retained at ${world.sidebarTemp}`
    throw error
  }
}

export async function stopSidebar(world) {
  if (world.sidebarPty) {
    // Keep the handle and files if close fails, including on repeated cleanup.
    try {
      await world.sidebarPty.close()
    } catch (error) {
      error.message += `; adapter and control retained at ${world.sidebarTemp}`
      throw error
    }
    world.sidebarPty = null
    world.sidebarCleanupUnconfirmed = false
  }
  if (world.sidebarCleanupUnconfirmed) {
    throw new Error(`Sidebar process cleanup unconfirmed; adapter and control retained at ${world.sidebarTemp}`)
  }
  if (world.sidebarTemp) {
    await rm(world.sidebarTemp, { recursive: true, force: true })
    world.sidebarTemp = null
  }
}
