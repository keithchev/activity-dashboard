
<?php

header("Content-type: application/json; charset=utf-8"); 

?>

<?php

$activityID = isset($_GET["id"]) ? $_GET["id"] : 0; 

$tableType = isset($_GET["type"]) ? $_GET["type"] : "preview";


if ($_SERVER["REMOTE_ADDR"]=="127.0.0.1" || $_SERVER["REMOTE_ADDR"]=="192.168.1.101") {
	$db_connection = pg_connect("host=localhost dbname=cycling user=postgres password=brc");
} else {
	$db_connection = pg_connect("host=cyclingpostgres.local dbname=cycling user=250742 password=pgc6646");
}

if ($tableType=="preview") {
	
	$result = pg_query($db_connection, "SELECT lat,lon FROM activities_preview WHERE id='$activityID'");
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

} elseif ($tableType=="detail") {
	$result = pg_query($db_connection, "SELECT alt,cad,dst,hrt,lat,lon,pwr,spd,tmp,sec FROM activities_detail WHERE id='$activityID'");
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
} else {
	$data = [];
}

echo json_encode($data);
pg_close($db_connection);

?>



