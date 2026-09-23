const testPermitCreation = async () => {
    try {
        const response = await fetch('http://localhost:3000/api/permits/hot-work', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // Base permit fields
                permit_type: 'hot_work',
                requester_id: '6936c864-7040-40e9-8811-082a764f8402', // Alice's seeded ID
                work_description: 'Emergency welding on the main cooling pipe',
                location: 'Plant Area B',
                planned_start: new Date().toISOString(),
                // Adds 4 hours to the current time for the end time
                planned_end: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),

                // Hot work specific fields
                hot_work_type: 'welding',
                fire_watch_required: true,
                fire_watch_name: 'John Doe',
                fire_blanket_used: true,
                flammable_gas_cleared: true
            })
        });

        const data = await response.json();
        console.log("Status Code:", response.status);
        console.log("Response Data:", JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Test failed:", error);
    }
};

testPermitCreation();