export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const address = searchParams.get("address");

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  try {
    let url: string;

    if (address) {
      // Forward geocode: address → coordinates
      url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    } else if (lat && lon) {
      // Reverse geocode: coordinates → address
      url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}`;
    } else {
      return Response.json({ error: "Provide either 'address' or 'lat' and 'lon'" }, { status: 400 });
    }

    const res = await fetch(url);

    if (!res.ok) {
      return Response.json({ error: "Geocoding failed" }, { status: 502 });
    }

    const data = await res.json();

    if (data.status !== "OK" || !data.results?.length) {
      return Response.json({ error: "No location found" }, { status: 404 });
    }

    const result = data.results[0];
    const components = result.address_components || [];
    const geo = result.geometry?.location;

    const getComponent = (type: string) =>
      components.find((c: { types: string[] }) => c.types.includes(type))?.long_name || "";

    return Response.json({
      formattedAddress: result.formatted_address,
      city: getComponent("locality") || getComponent("administrative_area_level_2"),
      state: getComponent("administrative_area_level_1"),
      country: getComponent("country"),
      pincode: getComponent("postal_code"),
      area: getComponent("sublocality_level_1") || getComponent("sublocality"),
      lat: geo?.lat || null,
      lon: geo?.lng || null,
    });
  } catch (err) {
    console.error("Location API error:", err);
    return Response.json({ error: "Location service unavailable" }, { status: 500 });
  }
}
