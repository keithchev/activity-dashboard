
<?php

header("Content-type: application/json; charset=utf-8"); 

?>

<?php

$activityID = isset($_GET["id"]) ? $_GET["id"] : 0; 

$tableType = isset($_GET["type"]) ? $_GET["type"] : "preview";

$db_connection = pg_connect("host=localhost dbname=cycling user=postgres password=brc");

if ($tableType=="preview") {
	
	$result = pg_query($db_connection, "SELECT lat,lon FROM activities_preview WHERE id=$activityID");
	$data = array();
	
	while ($row = pg_fetch_array($result)) { 
		foreach($row as $key => $value) {
			if (is_numeric($key)) {
				unset($row[$key]);
			}
		}
		$row['lat'] = floatval($row['lat']);
		$row['lon'] = floatval($row['lon']);

		$data[] = $row;
	}

} else {
	$result = pg_query($db_connection, "SELECT alt,cad,dst,hrt,lat,lon,pwr,spd,tmp,sec FROM activities WHERE id=$activityID");
	$data = array();

	while ($row = pg_fetch_array($result)) { 

		foreach($row as $key => $value) {
			if (is_numeric($key)) {
				unset($row[$key]);
			}
		}

		$row['pwr'] = intval($row['pwr']);
		$row['cad'] = intval($row['cad']);
		$row['hrt'] = intval($row['hrt']);
		$row['sec'] = intval($row['sec']);
		$row['tmp'] = intval($row['tmp']);

		$row['lat'] = floatval($row['lat']);
		$row['lon'] = floatval($row['lon']);
		$row['spd'] = floatval($row['spd']);
		$row['dst'] = floatval($row['dst']);
		$row['alt'] = floatval($row['alt']);

		$data[] = $row;
	} 
}

echo json_encode($data);
pg_close($db_connection);

?>



